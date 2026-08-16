// ============================================
// NS LUXURY VILLA — Guest Management Service
// ============================================

import { prisma } from '../config';
import { IdDocumentType } from '@prisma/client';

export interface CreateGuestDTO {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  idDocumentType?: IdDocumentType | string | null;
  idDocumentNumber?: string;
  dateOfBirth?: Date | string;
  nationality?: string;
  preferences?: string;
  notes?: string;
  isVip?: boolean;
}

export class GuestService {
  /** Get guests list with search & pagination */
  static async getGuests(filters?: { search?: string; isVip?: boolean }) {
    const where: any = {};
    if (filters?.isVip !== undefined) where.isVip = filters.isVip;
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { idDocumentNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return prisma.guest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { reservations: true, checkIns: true },
        },
      },
    });
  }

  /** Get guest details by ID */
  static async getGuestById(id: string) {
    return prisma.guest.findUnique({
      where: { id },
      include: {
        reservations: {
          include: {
            reservation: {
              include: { room: { include: { roomType: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        folios: {
          include: { items: true, payments: true },
        },
      },
    });
  }

  /** Create guest */
  static async createGuest(data: CreateGuestDTO) {
    return prisma.guest.create({
      data: {
        ...data,
        idDocumentType: (data.idDocumentType as IdDocumentType) || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      },
    });
  }

  /** Update guest */
  static async updateGuest(id: string, data: Partial<CreateGuestDTO>) {
    return prisma.guest.update({
      where: { id },
      data: {
        ...data,
        idDocumentType: data.idDocumentType !== undefined ? ((data.idDocumentType as IdDocumentType) || null) : undefined,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      },
    });
  }
}
