// NSVilla — POS domain service
// All totals and room-charge decisions are calculated server-side.

import { prisma } from '../config';
import { Prisma, PaymentMethod, PaymentStatus, PaymentType } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { CategoryService } from './categories.service';
import { AuditService } from './audit.service';
import { DailyCloseService, lockBusinessDay } from './daily-close.service';


const makeNumber = (prefix: string) => `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;

const assertPositiveInteger = (value: number, label: string) => {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive whole number.`);
};

const assertPositiveMoney = (value: number, label: string) => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be greater than zero.`);
};

async function findOpenFolio(tx: Prisma.TransactionClient, roomId: string, guestId?: string) {
  const stay = await tx.checkIn.findFirst({
    where: { roomId, reservation: { status: 'CHECKED_IN' } },
    include: { reservation: { include: { folios: { where: { status: 'OPEN' } } } } },
  });
  const folio = stay?.reservation.folios[0];
  if (!folio) throw new Error('No active guest stay or open folio was found for this room.');
  if (guestId && stay.guestId !== guestId) throw new Error('The selected guest is not the active guest for this room.');
  return { folio, guestId: stay.guestId };
}

async function recordDirectPayment(
  tx: Prisma.TransactionClient,
  data: { amount: Prisma.Decimal; method: PaymentMethod | string; source: string; sourceId: string; idempotencyKey: string; processedBy: string; description: string },
) {
  await lockBusinessDay(tx, new Date());
  await DailyCloseService.assertBusinessDayOpen(new Date());
  const payment = await tx.payment.create({
    data: {
      amount: data.amount,
      currency: 'GHS',
      method: data.method as PaymentMethod,
      source: data.source,
      sourceId: data.sourceId,
      idempotencyKey: data.idempotencyKey,
      status: PaymentStatus.COMPLETED,
      type: PaymentType.PAYMENT,
      description: data.description,
      processedBy: data.processedBy,
    },
  });
  await AuditService.logInTransaction(tx, {
    userId: data.processedBy,
    action: 'payment.created',
    resource: 'payment',
    resourceId: payment.id,
    afterData: { amount: payment.amount.toString(), method: payment.method, source: payment.source, sourceId: payment.sourceId },
  });
  return payment;
}

// Records a split direct settlement as one Payment row per tender.  The first
// row keeps the base idempotency key; subsequent rows use a `key#n` suffix so
// a repeated submission replays on the first row without duplicating entries.
async function recordDirectTenders(
  tx: Prisma.TransactionClient,
  data: { tenders: { method: string; amount: number; reference?: string }[]; source: string; sourceId: string; idempotencyKey: string; processedBy: string; description: string },
) {
  const payments: Awaited<ReturnType<typeof recordDirectPayment>>[] = [];
  for (let i = 0; i < data.tenders.length; i++) {
    const t = data.tenders[i];
    const payment = await recordDirectPayment(tx, {
      amount: new Prisma.Decimal(t.amount),
      method: t.method,
      source: data.source,
      sourceId: data.sourceId,
      idempotencyKey: i === 0 ? data.idempotencyKey : `${data.idempotencyKey}#${i}`,
      processedBy: data.processedBy,
      description: t.reference ? `${data.description} · ${t.reference}` : data.description,
    });
    payments.push(payment);
  }
  return payments;
}

export interface TenderLine {
  method: 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'BANK_TRANSFER';
  amount: number;
  reference?: string;
}

export interface RestaurantOrderDTO {
  guestId?: string;
  roomId?: string;
  tableNo?: string;
  paymentMethod: 'ROOM_CHARGE' | 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'BANK_TRANSFER';
  notes?: string;
  createdBy: string;
  idempotencyKey: string;
  items: { itemId: string; quantity: number; notes?: string }[];
  tenders?: TenderLine[];
}

export interface BarOrderDTO extends Omit<RestaurantOrderDTO, 'tableNo'> {}

export interface PoolTransactionDTO {
  guestId?: string;
  roomId?: string;
  serviceId: string;
  quantity: number;
  paymentMethod: 'ROOM_CHARGE' | 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'BANK_TRANSFER';
  notes?: string;
  processedBy: string;
  idempotencyKey: string;
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

  static async createRestaurantItem(data: { name: string; category: string; price: number; description?: string }) {
    assertPositiveMoney(data.price, 'Price');
    await CategoryService.assertConfiguredValue('RESTAURANT', data.category);
    return prisma.restaurantItem.create({ data });
  }

  static async updateRestaurantItem(id: string, data: { name?: string; category?: string; price?: number; description?: string }) {
    const existing = await prisma.restaurantItem.findUnique({ where: { id } });
    if (!existing) throw new Error('Restaurant item not found.');
    if (data.price !== undefined) assertPositiveMoney(data.price, 'Price');
    if (data.category) await CategoryService.assertConfiguredValue('RESTAURANT', data.category);
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
    const existing = await prisma.restaurantOrder.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      include: { orderItems: { include: { item: true } } },
    });
    if (existing) return existing;
    return prisma.$transaction(async tx => {
      const ids = [...new Set(data.items.map(i => i.itemId))];
      const catalog = await tx.restaurantItem.findMany({ where: { id: { in: ids }, isAvailable: true } });
      const byId = new Map(catalog.map(item => [item.id, item]));
      if (catalog.length !== ids.length) throw new Error('One or more selected restaurant items are unavailable.');

      const resolved = data.items.map(i => {
        assertPositiveInteger(i.quantity, 'Quantity');
        const item = byId.get(i.itemId)!;
        const unitPrice = new Prisma.Decimal(item.price);
        return { ...i, unitPrice, totalPrice: unitPrice.mul(i.quantity) };
      });
      const totalAmount = resolved.reduce((sum, i) => sum.plus(i.totalPrice), new Prisma.Decimal(0));
      assertPositiveMoney(totalAmount.toNumber(), 'Order total');

      const order = await tx.restaurantOrder.create({
        data: {
          orderNo: makeNumber('RES'), guestId: data.guestId, roomId: data.roomId, tableNo: data.tableNo,
          status: 'SERVED', totalAmount, paymentMethod: data.paymentMethod, paymentStatus: 'PENDING',
          notes: data.notes, createdBy: data.createdBy, idempotencyKey: data.idempotencyKey,
          orderItems: { create: resolved.map(i => ({ itemId: i.itemId, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice, notes: i.notes })) },
        },
        include: { orderItems: { include: { item: true } } },
      });
      // An order becomes authoritative only as this creation transaction is
      // finalised. Draft/cancelled orders never reach this path.


      let folioItemId: string | undefined;
      if (data.paymentMethod === 'ROOM_CHARGE') {
        if (data.tenders?.length) throw new Error('Split tenders cannot be charged to a room folio.');
        if (!data.roomId) throw new Error('A room is required when charging an order to a guest folio.');
        const { folio, guestId } = await findOpenFolio(tx, data.roomId, data.guestId);
        const summary = resolved.map(i => `${i.quantity}× ${byId.get(i.itemId)!.name}`).join(', ');
        const folioItem = await tx.folioItem.create({ data: { folioId: folio.id, type: 'RESTAURANT', description: `Restaurant order · ${summary}`, amount: totalAmount, quantity: 1, unitPrice: totalAmount, department: 'RESTAURANT', referenceId: order.id, referenceType: 'ORDER', postedBy: data.createdBy } });
        await tx.folio.update({ where: { id: folio.id }, data: { balance: { increment: totalAmount } } });
        folioItemId = folioItem.id;
        await tx.restaurantOrder.update({ where: { id: order.id }, data: { guestId, folioItemId, paymentStatus: 'CHARGED_TO_FOLIO', status: 'COMPLETED' } });
        await AuditService.logInTransaction(tx, { userId: data.createdBy, action: 'folio.charge_posted', resource: 'restaurant_order', resourceId: order.id, afterData: { folioId: folio.id, folioItemId, amount: totalAmount.toString() } });
      } else {
        const tenders = data.tenders?.length
          ? data.tenders
          : [{ method: data.paymentMethod, amount: totalAmount.toNumber() }];
        const tendersTotal = tenders.reduce((sum, t) => sum.plus(new Prisma.Decimal(t.amount)), new Prisma.Decimal(0));
        if (!tendersTotal.eq(totalAmount)) {
          throw new Error(`Tender amounts (${tendersTotal.toFixed(2)}) must equal the order total (${totalAmount.toFixed(2)}).`);
        }
        for (const t of tenders) {
          if (!['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER'].includes(t.method)) {
            throw new Error('Invalid tender method. Room charge must be the sole payment method.');
          }
          if (!Number.isFinite(t.amount) || t.amount <= 0) throw new Error('Each tender amount must be greater than zero.');
        }
        await recordDirectTenders(tx, { tenders, source: 'RESTAURANT_ORDER', sourceId: order.id, idempotencyKey: data.idempotencyKey, processedBy: data.createdBy, description: `Restaurant order ${order.orderNo}` });
        await tx.restaurantOrder.update({ where: { id: order.id }, data: { paymentStatus: 'PAID', status: 'COMPLETED' } });
      }
      return tx.restaurantOrder.findUniqueOrThrow({ where: { id: order.id }, include: { orderItems: { include: { item: true } } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  static getBarItems() {
    return prisma.barItem.findMany({ where: { isAvailable: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  static async createBarItem(data: { name: string; category: string; price: number; description?: string }) {
    assertPositiveMoney(data.price, 'Price');
    await CategoryService.assertConfiguredValue('BAR', data.category);
    return prisma.barItem.create({ data });
  }

  static async updateBarItem(id: string, data: { name?: string; category?: string; price?: number; description?: string }) {
    const existing = await prisma.barItem.findUnique({ where: { id } });
    if (!existing) throw new Error('Bar item not found.');
    if (data.price !== undefined) assertPositiveMoney(data.price, 'Price');
    if (data.category) await CategoryService.assertConfiguredValue('BAR', data.category);
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
    const existing = await prisma.barOrder.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      include: { orderItems: { include: { item: true } } },
    });
    if (existing) return existing;
    return prisma.$transaction(async tx => {
      const ids = [...new Set(data.items.map(i => i.itemId))];
      const catalog = await tx.barItem.findMany({ where: { id: { in: ids }, isAvailable: true } });
      const byId = new Map(catalog.map(item => [item.id, item]));
      if (catalog.length !== ids.length) throw new Error('One or more selected bar items are unavailable.');
      const resolved = data.items.map(i => { assertPositiveInteger(i.quantity, 'Quantity'); const item = byId.get(i.itemId)!; const unitPrice = new Prisma.Decimal(item.price); return { ...i, unitPrice, totalPrice: unitPrice.mul(i.quantity) }; });
      const totalAmount = resolved.reduce((sum, i) => sum.plus(i.totalPrice), new Prisma.Decimal(0));
      assertPositiveMoney(totalAmount.toNumber(), 'Order total');

      const order = await tx.barOrder.create({
        data: {
          orderNo: makeNumber('BAR'), guestId: data.guestId, roomId: data.roomId, status: 'SERVED', totalAmount,
          paymentMethod: data.paymentMethod, paymentStatus: 'PENDING', notes: data.notes, createdBy: data.createdBy,
          idempotencyKey: data.idempotencyKey,
          orderItems: { create: resolved.map(i => ({ itemId: i.itemId, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice, notes: i.notes })) },
        }, include: { orderItems: { include: { item: true } } },
      });


      let folioItemId: string | undefined;
      if (data.paymentMethod === 'ROOM_CHARGE') {
        if (data.tenders?.length) throw new Error('Split tenders cannot be charged to a room folio.');
        if (!data.roomId) throw new Error('A room is required when charging an order to a guest folio.');
        const { folio, guestId } = await findOpenFolio(tx, data.roomId, data.guestId);
        const summary = resolved.map(i => `${i.quantity}× ${byId.get(i.itemId)!.name}`).join(', ');
        const item = await tx.folioItem.create({ data: { folioId: folio.id, type: 'BAR', description: `Bar order · ${summary}`, amount: totalAmount, quantity: 1, unitPrice: totalAmount, department: 'BAR', referenceId: order.id, referenceType: 'ORDER', postedBy: data.createdBy } });
        await tx.folio.update({ where: { id: folio.id }, data: { balance: { increment: totalAmount } } });
        folioItemId = item.id;
        await tx.barOrder.update({ where: { id: order.id }, data: { guestId, folioItemId, paymentStatus: 'CHARGED_TO_FOLIO', status: 'COMPLETED' } });
        await AuditService.logInTransaction(tx, { userId: data.createdBy, action: 'folio.charge_posted', resource: 'bar_order', resourceId: order.id, afterData: { folioId: folio.id, folioItemId, amount: totalAmount.toString() } });
      } else {
        const tenders = data.tenders?.length
          ? data.tenders
          : [{ method: data.paymentMethod, amount: totalAmount.toNumber() }];
        const tendersTotal = tenders.reduce((sum, t) => sum.plus(new Prisma.Decimal(t.amount)), new Prisma.Decimal(0));
        if (!tendersTotal.eq(totalAmount)) {
          throw new Error(`Tender amounts (${tendersTotal.toFixed(2)}) must equal the order total (${totalAmount.toFixed(2)}).`);
        }
        for (const t of tenders) {
          if (!['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER'].includes(t.method)) {
            throw new Error('Invalid tender method. Room charge must be the sole payment method.');
          }
          if (!Number.isFinite(t.amount) || t.amount <= 0) throw new Error('Each tender amount must be greater than zero.');
        }
        await recordDirectTenders(tx, { tenders, source: 'BAR_ORDER', sourceId: order.id, idempotencyKey: data.idempotencyKey, processedBy: data.createdBy, description: `Bar order ${order.orderNo}` });
        await tx.barOrder.update({ where: { id: order.id }, data: { paymentStatus: 'PAID', status: 'COMPLETED' } });
      }
      return tx.barOrder.findUniqueOrThrow({ where: { id: order.id }, include: { orderItems: { include: { item: true } } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  static async getPoolServices(includeUnavailable = false) {
    const where = includeUnavailable ? {} : { isAvailable: true };
    const services = await prisma.poolService.findMany({ where, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    if (services.length === 0 && !includeUnavailable) {
      const existingCat = await prisma.itemCategory.findFirst({ where: { type: 'POOL' } });
      const catName = existingCat?.name || 'DAY_PASS';
      if (!existingCat) {
        await prisma.itemCategory.create({
          data: { type: 'POOL', name: 'DAY_PASS', description: 'Pool Day Passes and Services' },
        }).catch(() => {});
      }
      const defaultServices = [
        { name: 'Day Pass — Adult', category: catName, description: 'Full day pool & deck access', price: new Prisma.Decimal(100) },
        { name: 'Day Pass — Child', category: catName, description: 'Full day pool access for children', price: new Prisma.Decimal(50) },
        { name: 'Pool Towel Rental', category: catName, description: 'Fresh clean pool towel', price: new Prisma.Decimal(25) },
      ];
      for (const def of defaultServices) {
        await prisma.poolService.upsert({
          where: { name: def.name },
          update: { isAvailable: true },
          create: def,
        }).catch(() => {});
      }
      return prisma.poolService.findMany({ where, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    }
    return services;
  }

  static async createPoolService(data: { name: string; category: string; price: number; description?: string }) {
    assertPositiveMoney(data.price, 'Price');
    await CategoryService.assertConfiguredValue('POOL', data.category);
    return prisma.poolService.create({ data });
  }

  static async updatePoolService(id: string, data: { name?: string; category?: string; price?: number; description?: string }) {
    const existing = await prisma.poolService.findUnique({ where: { id } });
    if (!existing) throw new Error('Pool service not found.');
    if (data.price !== undefined) assertPositiveMoney(data.price, 'Price');
    if (data.category) await CategoryService.assertConfiguredValue('POOL', data.category);
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

  static async updatePoolAttendance(id: string, data: { visitorName?: string; phone?: string; partySize?: number; notes?: string }) {
    const existing = await prisma.poolAttendance.findUnique({ where: { id } });
    if (!existing) throw new Error('Pool attendance record not found.');
    if (data.partySize !== undefined) assertPositiveInteger(data.partySize, 'Number of visitors');
    return prisma.poolAttendance.update({
      where: { id },
      data: {
        visitorName: data.visitorName?.trim() || existing.visitorName,
        phone: data.phone !== undefined ? (data.phone?.trim() || null) : existing.phone,
        partySize: data.partySize !== undefined ? data.partySize : existing.partySize,
        notes: data.notes !== undefined ? (data.notes?.trim() || null) : existing.notes,
      },
    });
  }

  static async deletePoolAttendance(id: string) {
    const existing = await prisma.poolAttendance.findUnique({ where: { id } });
    if (!existing) throw new Error('Pool attendance record not found.');
    return prisma.poolAttendance.delete({ where: { id } });
  }

  static async deletePoolTransaction(id: string, userId: string) {
    return prisma.$transaction(async tx => {
      const existing = await tx.poolTransaction.findUnique({ where: { id } });
      if (!existing) throw new Error('Pool transaction not found.');

      if (existing.folioItemId) {
        const item = await tx.folioItem.findUnique({ where: { id: existing.folioItemId } });
        if (item && !item.voidedAt) {
          await tx.folioItem.update({
            where: { id: item.id },
            data: { voidedAt: new Date(), voidedBy: userId, voidReason: 'Pool transaction deleted' },
          });
          await tx.folio.update({
            where: { id: item.folioId },
            data: { balance: { decrement: item.amount } },
          });
        }
      }

      // Void any direct payments
      await tx.payment.updateMany({
        where: { source: 'POOL_TRANSACTION', sourceId: id, voidedAt: null },
        data: { voidedAt: new Date(), voidedBy: userId, voidReason: 'Pool transaction deleted' },
      });

      await AuditService.logInTransaction(tx, {
        userId,
        action: 'pos.pool_transaction_deleted',
        resource: 'pool_transaction',
        resourceId: id,
        beforeData: { transactionNo: existing.transactionNo, amount: existing.totalAmount.toString() },
      });

      return tx.poolTransaction.delete({ where: { id } });
    });
  }

  static async createPoolTransaction(data: PoolTransactionDTO) {
    assertPositiveInteger(data.quantity, 'Quantity');
    const existing = await prisma.poolTransaction.findUnique({ where: { idempotencyKey: data.idempotencyKey }, include: { service: true } });
    if (existing) return existing;
    return prisma.$transaction(async tx => {
      const service = await tx.poolService.findFirst({ where: { id: data.serviceId, isAvailable: true } });
      if (!service) throw new Error('The selected pool service is unavailable.');
      const unitPrice = new Prisma.Decimal(service.price);
      const totalAmount = unitPrice.mul(data.quantity);
      const transaction = await tx.poolTransaction.create({
        data: {
          transactionNo: makeNumber('POL'), guestId: data.guestId, roomId: data.roomId, serviceId: data.serviceId,
          quantity: data.quantity, unitPrice, totalAmount, paymentMethod: data.paymentMethod,
          paymentStatus: 'PENDING', notes: data.notes, processedBy: data.processedBy, idempotencyKey: data.idempotencyKey,
        }, include: { service: true },
      });

      let folioItemId: string | undefined;

      if (data.paymentMethod === 'ROOM_CHARGE') {
        if (!data.roomId) throw new Error('A room is required when charging a pool service to a guest folio.');
        const { folio, guestId } = await findOpenFolio(tx, data.roomId, data.guestId);
        const item = await tx.folioItem.create({ data: { folioId: folio.id, type: 'POOL', description: service.name, amount: totalAmount, quantity: data.quantity, unitPrice, department: 'POOL', referenceId: transaction.id, referenceType: 'TRANSACTION', postedBy: data.processedBy } });
        await tx.folio.update({ where: { id: folio.id }, data: { balance: { increment: totalAmount } } });
        folioItemId = item.id;
        await tx.poolTransaction.update({ where: { id: transaction.id }, data: { guestId, folioItemId, paymentStatus: 'CHARGED_TO_FOLIO' } });
        await AuditService.logInTransaction(tx, { userId: data.processedBy, action: 'folio.charge_posted', resource: 'pool_transaction', resourceId: transaction.id, afterData: { folioId: folio.id, folioItemId, amount: totalAmount.toString() } });
      } else {
        await recordDirectPayment(tx, { amount: totalAmount, method: data.paymentMethod, source: 'POOL_TRANSACTION', sourceId: transaction.id, idempotencyKey: data.idempotencyKey, processedBy: data.processedBy, description: `Pool transaction ${transaction.transactionNo}` });
        await tx.poolTransaction.update({ where: { id: transaction.id }, data: { paymentStatus: 'PAID' } });
      }
      return tx.poolTransaction.findUniqueOrThrow({ where: { id: transaction.id }, include: { service: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
