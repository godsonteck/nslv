// NSVilla — POS domain service
// All totals and room-charge decisions are calculated server-side.

import { prisma } from '../config';
import { randomBytes } from 'node:crypto';

const makeNumber = (prefix: string) => `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;

const assertPositiveInteger = (value: number, label: string) => {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive whole number.`);
};

const assertPositiveMoney = (value: number, label: string) => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be greater than zero.`);
};

async function findOpenFolio(tx: any, roomId: string) {
  const stay = await tx.checkIn.findFirst({
    where: { roomId, reservation: { status: 'CHECKED_IN' } },
    include: { reservation: { include: { folios: { where: { status: 'OPEN' } } } } },
  });
  const folio = stay?.reservation.folios[0];
  if (!folio) throw new Error('No active guest stay or open folio was found for this room.');
  return folio;
}

export interface RestaurantOrderDTO {
  guestId?: string;
  roomId?: string;
  tableNo?: string;
  paymentMethod: 'ROOM_CHARGE' | 'CASH' | 'CARD' | 'MOBILE_MONEY';
  notes?: string;
  createdBy: string;
  items: { itemId: string; quantity: number; notes?: string }[];
}

export interface BarOrderDTO extends Omit<RestaurantOrderDTO, 'tableNo'> {}

export interface PoolTransactionDTO {
  guestId?: string;
  roomId?: string;
  serviceId: string;
  quantity: number;
  paymentMethod: 'ROOM_CHARGE' | 'CASH' | 'CARD' | 'MOBILE_MONEY';
  notes?: string;
  processedBy: string;
}

export interface PoolAttendanceDTO {
  visitorName: string;
  phone?: string;
  partySize: number;
  notes?: string;
  recordedBy: string;
}

export class POSService {
  static getRestaurantItems() {
    return prisma.restaurantItem.findMany({ where: { isAvailable: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  static createRestaurantItem(data: { name: string; category: string; price: number; description?: string }) {
    assertPositiveMoney(data.price, 'Price');
    return prisma.restaurantItem.create({ data });
  }

  static async updateRestaurantItem(id: string, data: { name?: string; category?: string; price?: number; description?: string }) {
    const existing = await prisma.restaurantItem.findUnique({ where: { id } });
    if (!existing) throw new Error('Restaurant item not found.');
    if (data.price !== undefined) assertPositiveMoney(data.price, 'Price');
    return prisma.restaurantItem.update({ where: { id }, data });
  }

  static async toggleRestaurantItem(id: string, isAvailable: boolean) {
    const existing = await prisma.restaurantItem.findUnique({ where: { id } });
    if (!existing) throw new Error('Restaurant item not found.');
    return prisma.restaurantItem.update({ where: { id }, data: { isAvailable } });
  }

  static async deleteRestaurantItem(id: string) {
    const existing = await prisma.restaurantItem.findUnique({ where: { id } });
    if (!existing) throw new Error('Restaurant item not found.');
    // Items that have ever been sold are retained for order history; hide them instead.
    const used = await prisma.restaurantOrderItem.count({ where: { itemId: id } });
    if (used > 0) {
      return prisma.restaurantItem.update({ where: { id }, data: { isAvailable: false } });
    }
    return prisma.restaurantItem.delete({ where: { id } });
  }

  static getRestaurantOrders() {
    return prisma.restaurantOrder.findMany({ include: { orderItems: { include: { item: true } } }, orderBy: { createdAt: 'desc' } });
  }

  static async createRestaurantOrder(data: RestaurantOrderDTO) {
    if (!data.items?.length) throw new Error('At least one restaurant item is required.');
    return prisma.$transaction(async tx => {
      const ids = [...new Set(data.items.map(i => i.itemId))];
      const catalog = await tx.restaurantItem.findMany({ where: { id: { in: ids }, isAvailable: true } });
      const byId = new Map(catalog.map(item => [item.id, item]));
      if (catalog.length !== ids.length) throw new Error('One or more selected restaurant items are unavailable.');

      const resolved = data.items.map(i => {
        assertPositiveInteger(i.quantity, 'Quantity');
        const item = byId.get(i.itemId)!;
        const unitPrice = Number(item.price);
        return { ...i, unitPrice, totalPrice: i.quantity * unitPrice };
      });
      const totalAmount = resolved.reduce((sum, i) => sum + i.totalPrice, 0);
      assertPositiveMoney(totalAmount, 'Order total');

      let folioItemId: string | undefined;
      if (data.paymentMethod === 'ROOM_CHARGE') {
        if (!data.roomId) throw new Error('A room is required when charging an order to a guest folio.');
        const folio = await findOpenFolio(tx, data.roomId);
        const summary = resolved.map(i => `${i.quantity}× ${byId.get(i.itemId)!.name}`).join(', ');
        const folioItem = await tx.folioItem.create({ data: { folioId: folio.id, type: 'RESTAURANT', description: `Restaurant order · ${summary}`, amount: totalAmount, quantity: 1, unitPrice: totalAmount, department: 'RESTAURANT', referenceType: 'ORDER', postedBy: data.createdBy } });
        await tx.folio.update({ where: { id: folio.id }, data: { balance: { increment: totalAmount } } });
        folioItemId = folioItem.id;
      }

      const order = await tx.restaurantOrder.create({
        data: {
          orderNo: makeNumber('RES'), guestId: data.guestId, roomId: data.roomId, tableNo: data.tableNo,
          status: 'COMPLETED', totalAmount, paymentMethod: data.paymentMethod,
          paymentStatus: data.paymentMethod === 'ROOM_CHARGE' ? 'CHARGED_TO_FOLIO' : 'PAID',
          folioItemId, notes: data.notes, createdBy: data.createdBy,
          orderItems: { create: resolved.map(i => ({ itemId: i.itemId, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice, notes: i.notes })) },
        },
        include: { orderItems: { include: { item: true } } },
      });
      return order;
    });
  }

  static getBarItems() {
    return prisma.barItem.findMany({ where: { isAvailable: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  static createBarItem(data: { name: string; category: string; price: number; description?: string }) {
    assertPositiveMoney(data.price, 'Price');
    return prisma.barItem.create({ data });
  }

  static async updateBarItem(id: string, data: { name?: string; category?: string; price?: number; description?: string }) {
    const existing = await prisma.barItem.findUnique({ where: { id } });
    if (!existing) throw new Error('Bar item not found.');
    if (data.price !== undefined) assertPositiveMoney(data.price, 'Price');
    return prisma.barItem.update({ where: { id }, data });
  }

  static async toggleBarItem(id: string, isAvailable: boolean) {
    const existing = await prisma.barItem.findUnique({ where: { id } });
    if (!existing) throw new Error('Bar item not found.');
    return prisma.barItem.update({ where: { id }, data: { isAvailable } });
  }

  static async deleteBarItem(id: string) {
    const existing = await prisma.barItem.findUnique({ where: { id } });
    if (!existing) throw new Error('Bar item not found.');
    const used = await prisma.barOrderItem.count({ where: { itemId: id } });
    if (used > 0) {
      return prisma.barItem.update({ where: { id }, data: { isAvailable: false } });
    }
    return prisma.barItem.delete({ where: { id } });
  }

  static getBarOrders() {
    return prisma.barOrder.findMany({ include: { orderItems: { include: { item: true } } }, orderBy: { createdAt: 'desc' } });
  }

  static async createBarOrder(data: BarOrderDTO) {
    if (!data.items?.length) throw new Error('At least one bar item is required.');
    return prisma.$transaction(async tx => {
      const ids = [...new Set(data.items.map(i => i.itemId))];
      const catalog = await tx.barItem.findMany({ where: { id: { in: ids }, isAvailable: true } });
      const byId = new Map(catalog.map(item => [item.id, item]));
      if (catalog.length !== ids.length) throw new Error('One or more selected bar items are unavailable.');
      const resolved = data.items.map(i => { assertPositiveInteger(i.quantity, 'Quantity'); const item = byId.get(i.itemId)!; const unitPrice = Number(item.price); return { ...i, unitPrice, totalPrice: i.quantity * unitPrice }; });
      const totalAmount = resolved.reduce((sum, i) => sum + i.totalPrice, 0);
      assertPositiveMoney(totalAmount, 'Order total');

      let folioItemId: string | undefined;
      if (data.paymentMethod === 'ROOM_CHARGE') {
        if (!data.roomId) throw new Error('A room is required when charging an order to a guest folio.');
        const folio = await findOpenFolio(tx, data.roomId);
        const summary = resolved.map(i => `${i.quantity}× ${byId.get(i.itemId)!.name}`).join(', ');
        const item = await tx.folioItem.create({ data: { folioId: folio.id, type: 'BAR', description: `Bar order · ${summary}`, amount: totalAmount, quantity: 1, unitPrice: totalAmount, department: 'BAR', referenceType: 'ORDER', postedBy: data.createdBy } });
        await tx.folio.update({ where: { id: folio.id }, data: { balance: { increment: totalAmount } } });
        folioItemId = item.id;
      }

      return tx.barOrder.create({
        data: {
          orderNo: makeNumber('BAR'), guestId: data.guestId, roomId: data.roomId, status: 'COMPLETED', totalAmount,
          paymentMethod: data.paymentMethod, paymentStatus: data.paymentMethod === 'ROOM_CHARGE' ? 'CHARGED_TO_FOLIO' : 'PAID',
          folioItemId, notes: data.notes, createdBy: data.createdBy,
          orderItems: { create: resolved.map(i => ({ itemId: i.itemId, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice, notes: i.notes })) },
        }, include: { orderItems: { include: { item: true } } },
      });
    });
  }

  static getPoolServices() {
    return prisma.poolService.findMany({ where: { isAvailable: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  static createPoolService(data: { name: string; category: string; price: number; description?: string }) {
    assertPositiveMoney(data.price, 'Price');
    return prisma.poolService.create({ data });
  }

  static async updatePoolService(id: string, data: { name?: string; category?: string; price?: number; description?: string }) {
    const existing = await prisma.poolService.findUnique({ where: { id } });
    if (!existing) throw new Error('Pool service not found.');
    if (data.price !== undefined) assertPositiveMoney(data.price, 'Price');
    return prisma.poolService.update({ where: { id }, data });
  }

  static async togglePoolService(id: string, isAvailable: boolean) {
    const existing = await prisma.poolService.findUnique({ where: { id } });
    if (!existing) throw new Error('Pool service not found.');
    return prisma.poolService.update({ where: { id }, data: { isAvailable } });
  }

  static async deletePoolService(id: string) {
    const existing = await prisma.poolService.findUnique({ where: { id } });
    if (!existing) throw new Error('Pool service not found.');
    const used = await prisma.poolTransaction.count({ where: { serviceId: id } });
    if (used > 0) {
      return prisma.poolService.update({ where: { id }, data: { isAvailable: false } });
    }
    return prisma.poolService.delete({ where: { id } });
  }

  static getPoolTransactions() {
    return prisma.poolTransaction.findMany({ include: { service: true }, orderBy: { createdAt: 'desc' } });
  }

  static getPoolAttendance() {
    return prisma.poolAttendance.findMany({ orderBy: { createdAt: 'desc' } });
  }

  static createPoolAttendance(data: PoolAttendanceDTO) {
    const visitorName = data.visitorName?.trim();
    if (!visitorName) throw new Error('Visitor name is required.');
    assertPositiveInteger(data.partySize, 'Number of visitors');
    return prisma.poolAttendance.create({
      data: { visitorName, phone: data.phone?.trim() || undefined, partySize: data.partySize, notes: data.notes?.trim() || undefined, recordedBy: data.recordedBy },
    });
  }

  static async createPoolTransaction(data: PoolTransactionDTO) {
    assertPositiveInteger(data.quantity, 'Quantity');
    return prisma.$transaction(async tx => {
      const service = await tx.poolService.findFirst({ where: { id: data.serviceId, isAvailable: true } });
      if (!service) throw new Error('The selected pool service is unavailable.');
      const unitPrice = Number(service.price);
      const totalAmount = data.quantity * unitPrice;
      let folioItemId: string | undefined;

      if (data.paymentMethod === 'ROOM_CHARGE') {
        if (!data.roomId) throw new Error('A room is required when charging a pool service to a guest folio.');
        const folio = await findOpenFolio(tx, data.roomId);
        const item = await tx.folioItem.create({ data: { folioId: folio.id, type: 'POOL', description: service.name, amount: totalAmount, quantity: data.quantity, unitPrice, department: 'POOL', referenceType: 'TRANSACTION', postedBy: data.processedBy } });
        await tx.folio.update({ where: { id: folio.id }, data: { balance: { increment: totalAmount } } });
        folioItemId = item.id;
      }

      return tx.poolTransaction.create({
        data: {
          transactionNo: makeNumber('POL'), guestId: data.guestId, roomId: data.roomId, serviceId: data.serviceId,
          quantity: data.quantity, unitPrice, totalAmount, paymentMethod: data.paymentMethod,
          paymentStatus: data.paymentMethod === 'ROOM_CHARGE' ? 'CHARGED_TO_FOLIO' : 'PAID', folioItemId,
          notes: data.notes, processedBy: data.processedBy,
        }, include: { service: true },
      });
    });
  }
}
