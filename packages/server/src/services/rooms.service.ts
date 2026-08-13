// ============================================
// NS LUXURY VILLA — Room Management Service
// ============================================

import { prisma } from '../config';

export interface CreateRoomTypeDTO {
  name: string;
  description?: string;
  basePrice: number;
  maxAdults?: number;
  maxChildren?: number;
  amenityIds?: string[];
}

export interface CreateRoomDTO {
  number: string;
  name?: string;
  roomTypeId: string;
  floor?: number;
  notes?: string;
}

export class RoomService {
  /** Get all room types */
  static async getRoomTypes() {
    return prisma.roomType.findMany({
      where: { isActive: true },
      include: {
        amenities: {
          include: { amenity: true },
        },
        _count: { select: { rooms: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Create a new room type */
  static async createRoomType(data: CreateRoomTypeDTO) {
    const { amenityIds, ...rest } = data;
    return prisma.roomType.create({
      data: {
        ...rest,
        amenities: amenityIds
          ? {
              create: amenityIds.map((id) => ({ amenityId: id })),
            }
          : undefined,
      },
    });
  }

  /** List all room amenities for configuration */
  static getAmenities() {
    return prisma.roomAmenity.findMany({ orderBy: { name: 'asc' } });
  }

  /** Create a new room amenity */
  static async createAmenity(data: { name: string; icon?: string; category?: string }) {
    const existing = await prisma.roomAmenity.findUnique({ where: { name: data.name } });
    if (existing) throw new Error(`Amenity "${data.name}" already exists.`);
    return prisma.roomAmenity.create({ data });
  }

  /** Update a room amenity */
  static async updateAmenity(id: string, data: { name?: string; icon?: string; category?: string }) {
    const existing = await prisma.roomAmenity.findUnique({ where: { id } });
    if (!existing) throw new Error('Amenity not found.');
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.roomAmenity.findUnique({ where: { name: data.name } });
      if (duplicate) throw new Error(`Amenity "${data.name}" already exists.`);
    }
    return prisma.roomAmenity.update({ where: { id }, data });
  }

  /** Delete a room amenity */
  static async deleteAmenity(id: string) {
    const existing = await prisma.roomAmenity.findUnique({
      where: { id },
      include: { _count: { select: { roomTypes: true } } },
    });
    if (!existing) throw new Error('Amenity not found.');
    if (existing._count.roomTypes > 0) {
      throw new Error(`Cannot delete amenity "${existing.name}" because it is currently assigned to ${existing._count.roomTypes} room type(s).`);
    }
    return prisma.roomAmenity.delete({ where: { id } });
  }

  /** Update a room type, optionally replacing its amenities */
  static async updateRoomType(
    id: string,
    data: {
      name?: string;
      description?: string;
      basePrice?: number;
      maxAdults?: number;
      maxChildren?: number;
      sortOrder?: number;
      isActive?: boolean;
      amenityIds?: string[];
    },
  ) {
    const existing = await prisma.roomType.findUnique({ where: { id } });
    if (!existing) throw new Error('Room type not found.');
    if (data.basePrice !== undefined && (!Number.isFinite(data.basePrice) || data.basePrice <= 0)) {
      throw new Error('Base price must be greater than zero.');
    }

    const { amenityIds, ...rest } = data;
    return prisma.$transaction(async (tx) => {
      const updated = await tx.roomType.update({
        where: { id },
        data: { ...rest },
      });
      if (amenityIds) {
        await tx.roomTypeAmenity.deleteMany({ where: { roomTypeId: id } });
        if (amenityIds.length > 0) {
          await tx.roomTypeAmenity.createMany({
            data: amenityIds.map((amenityId) => ({ roomTypeId: id, amenityId })),
          });
        }
      }
      return updated;
    });
  }

  /**
   * Delete a room type. Hard-deletes when unused; when rooms exist it is
   * deactivated instead so existing rooms, reservations and history stay valid.
   */
  static async deleteRoomType(id: string) {
    const existing = await prisma.roomType.findUnique({
      where: { id },
      include: { _count: { select: { rooms: true } } },
    });
    if (!existing) throw new Error('Room type not found.');

    if (existing._count.rooms > 0) {
      const updated = await prisma.roomType.update({ where: { id }, data: { isActive: false } });
      return { ...updated, softDeleted: true, roomCount: existing._count.rooms };
    }

    await prisma.roomType.delete({ where: { id } });
    return { id, softDeleted: false, roomCount: 0 };
  }

  /** Get all rooms with room types */
  static async getRooms(filters?: { status?: string; roomTypeId?: string; search?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.roomTypeId) where.roomTypeId = filters.roomTypeId;
    if (filters?.search) {
      where.OR = [
        { number: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return prisma.room.findMany({
      where,
      include: {
        roomType: true,
      },
      orderBy: { number: 'asc' },
    });
  }

  /** Get room by ID */
  static async getRoomById(id: string) {
    return prisma.room.findUnique({
      where: { id },
      include: { roomType: true },
    });
  }

  /** Create a new room */
  static async createRoom(data: CreateRoomDTO) {
    return prisma.room.create({
      data,
      include: { roomType: true },
    });
  }

  /** Update room status (AVAILABLE, RESERVED, OCCUPIED, DIRTY, READY, OUT_OF_SERVICE) */
  static async updateRoomStatus(id: string, status: string, notes?: string) {
    return prisma.room.update({
      where: { id },
      data: { status, notes },
      include: { roomType: true },
    });
  }

  /** Update room details (number, name, type, floor, notes) */
  static async updateRoom(id: string, data: Partial<CreateRoomDTO>) {
    return prisma.room.update({
      where: { id },
      data,
      include: { roomType: true },
    });
  }

  /** Delete a room (blocked by DB if it has reservations/check-ins) */
  static async deleteRoom(id: string) {
    return prisma.room.delete({ where: { id } });
  }
}
