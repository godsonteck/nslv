// ============================================
// NS LUXURY VILLA — Guest Management Service
// ============================================

import { prisma } from '../config';
import { IdDocumentType } from '@prisma/client';

export interface CreateGuestDTO {
  firstName: string;
  lastName?: string | null;
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
  /** Fields considered sensitive — only visible to users holding guests.view_sensitive */
  static readonly SENSITIVE_FIELDS: readonly string[] = [
    'idDocumentType',
    'idDocumentNumber',
    'dateOfBirth',
    'email',
    'phone',
    'address',
    'city',
    'country',
    'nationality',
    'preferences',
    'notes',
  ];

  /** Strip sensitive fields from a guest record (list or detail shape) */
  static sanitize<T extends Record<string, unknown>>(guest: T): T {
    if (!guest) return guest;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(guest)) {
      if (!GuestService.SENSITIVE_FIELDS.includes(key)) out[key] = guest[key];
    }
    return out as T;
  }

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
    const payload = {
      ...data,
      lastName: data.lastName ?? null,
      idDocumentType: (data.idDocumentType as IdDocumentType) || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
    };
    return prisma.guest.create({ data: payload as any });
  }

  /** Update guest */
  static async updateGuest(id: string, data: Partial<CreateGuestDTO>) {
    const payload: Record<string, unknown> = {};

    if (data.firstName !== undefined)        payload.firstName        = data.firstName;
    if ('lastName' in data)                  payload.lastName         = data.lastName ?? null;
    if (data.email !== undefined)            payload.email            = data.email;
    if (data.phone !== undefined)            payload.phone            = data.phone;
    if (data.address !== undefined)          payload.address          = data.address;
    if (data.city !== undefined)             payload.city             = data.city;
    if (data.country !== undefined)          payload.country          = data.country;
    if (data.idDocumentNumber !== undefined) payload.idDocumentNumber = data.idDocumentNumber;
    if (data.nationality !== undefined)      payload.nationality      = data.nationality;
    if (data.preferences !== undefined)      payload.preferences      = data.preferences;
    if (data.notes !== undefined)            payload.notes            = data.notes;
    if (data.isVip !== undefined)            payload.isVip            = data.isVip;
    if (data.idDocumentType !== undefined)   payload.idDocumentType   = (data.idDocumentType as IdDocumentType) || null;
    if (data.dateOfBirth !== undefined)      payload.dateOfBirth      = data.dateOfBirth ? new Date(data.dateOfBirth) : null;

    return prisma.guest.update({ where: { id }, data: payload as any });
  }
}
