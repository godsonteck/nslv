// NSVilla — Events domain service
// Event spaces and event bookings (birthdays, weddings, corporate, private parties).

import { prisma } from '../config';

const assertEmptyTitle = (title: string) => {
  if (!title?.trim()) throw new Error('Event title is required.');
};

const assertValidWindow = (startAt: Date, endAt: Date) => {
  if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) throw new Error('A valid start date and time is required.');
  if (!(endAt instanceof Date) || Number.isNaN(endAt.getTime())) throw new Error('A valid end date and time is required.');
  if (endAt.getTime() <= startAt.getTime()) throw new Error('The event end time must be after the start time.');
};

const assertGuestCount = (value: number | undefined, label: string): number => {
  const n = value === undefined ? 0 : Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${label} must be a whole number of guests.`);
  return n;
};

const assertMoney = (value: number | undefined, label: string): number => {
  const n = value === undefined ? 0 : Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be zero or greater.`);
  return n;
};

export interface EventSpaceDTO {
  name: string;
  description?: string;
  location?: string;
  capacity?: number;
  pricePerHour?: number;
  isActive?: boolean;
}

export type EventStatus = 'PLANNED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface EventBookingDTO {
  title: string;
  description?: string;
  eventSpaceId?: string | null;
  startAt: string;
  endAt: string;
  status?: EventStatus;
  guestCount?: number;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  createdById?: string;
}

export class EventsService {
  // ──────────────────────────────────────────
  // Event spaces
  // ──────────────────────────────────────────

  static listSpaces() {
    return prisma.eventSpace.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { bookings: true } } },
    });
  }

  static async createSpace(data: EventSpaceDTO) {
    if (!data.name?.trim()) throw new Error('Event space name is required.');
    const capacity = Number.isInteger(data.capacity) ? Number(data.capacity) : 0;
    const pricePerHour = assertMoney(data.pricePerHour, 'Price per hour');
    return prisma.eventSpace.create({
      data: {
        name: data.name.trim(),
        description: data.description || null,
        location: data.location || null,
        capacity: capacity >= 0 ? capacity : 0,
        pricePerHour,
        isActive: data.isActive ?? true,
      },
      include: { _count: { select: { bookings: true } } },
    });
  }

  static async updateSpace(id: string, data: Partial<EventSpaceDTO>) {
    const existing = await prisma.eventSpace.findUnique({ where: { id } });
    if (!existing) throw new Error('Event space not found.');
    return prisma.eventSpace.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.location !== undefined ? { location: data.location || null } : {}),
        ...(data.capacity !== undefined ? { capacity: Math.max(0, Math.trunc(Number(data.capacity) || 0)) } : {}),
        ...(data.pricePerHour !== undefined ? { pricePerHour: assertMoney(data.pricePerHour, 'Price per hour') } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include: { _count: { select: { bookings: true } } },
    });
  }

  static async deleteSpace(id: string) {
    const existing = await prisma.eventSpace.findUnique({ where: { id } });
    if (!existing) throw new Error('Event space not found.');
    await prisma.eventSpace.delete({ where: { id } });
    return { deleted: true };
  }

  // ──────────────────────────────────────────
  // Event bookings
  // ──────────────────────────────────────────

  static listBookings(from?: string, to?: string) {
    const where: {
      startAt?: { gte?: Date; lte?: Date };
      status?: { not: string };
    } = {};
    if (from) where.startAt = { ...(where.startAt || {}), gte: new Date(from) };
    if (to) where.startAt = { ...(where.startAt || {}), lte: new Date(to) };
    return prisma.eventBooking.findMany({
      where,
      include: { eventSpace: true },
      orderBy: [{ startAt: 'asc' }],
    });
  }

  static getBooking(id: string) {
    return prisma.eventBooking.findUnique({ where: { id }, include: { eventSpace: true } });
  }

  static async createBooking(data: EventBookingDTO, userId?: string) {
    assertEmptyTitle(data.title);
    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);
    assertValidWindow(startAt, endAt);
    const guestCount = assertGuestCount(data.guestCount, 'Guest count');
    if (data.eventSpaceId) {
      await this.assertSpaceAvailable(data.eventSpaceId, startAt, endAt, undefined);
    }
    return prisma.eventBooking.create({
      data: {
        title: data.title.trim(),
        description: data.description || null,
        eventSpaceId: data.eventSpaceId || null,
        startAt,
        endAt,
        status: data.status || 'CONFIRMED',
        guestCount,
        contactName: data.contactName || null,
        contactPhone: data.contactPhone || null,
        contactEmail: data.contactEmail || null,
        notes: data.notes || null,
        createdById: userId || null,
      },
      include: { eventSpace: true },
    });
  }

  static async updateBooking(id: string, data: Partial<EventBookingDTO>) {
    const existing = await prisma.eventBooking.findUnique({ where: { id } });
    if (!existing) throw new Error('Event not found.');

    const startAt = data.startAt !== undefined ? new Date(data.startAt) : existing.startAt;
    const endAt = data.endAt !== undefined ? new Date(data.endAt) : existing.endAt;
    assertValidWindow(startAt, endAt);
    if (data.title !== undefined) assertEmptyTitle(data.title);
    const guestCount = data.guestCount !== undefined ? assertGuestCount(data.guestCount, 'Guest count') : existing.guestCount;

    const eventSpaceId = data.eventSpaceId !== undefined ? data.eventSpaceId : existing.eventSpaceId;
    if (eventSpaceId) {
      await this.assertSpaceAvailable(eventSpaceId, startAt, endAt, id);
    }

    return prisma.eventBooking.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.eventSpaceId !== undefined ? { eventSpaceId: data.eventSpaceId || null } : {}),
        ...(data.startAt !== undefined ? { startAt } : {}),
        ...(data.endAt !== undefined ? { endAt } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.guestCount !== undefined ? { guestCount } : {}),
        ...(data.contactName !== undefined ? { contactName: data.contactName || null } : {}),
        ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone || null } : {}),
        ...(data.contactEmail !== undefined ? { contactEmail: data.contactEmail || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      },
      include: { eventSpace: true },
    });
  }

  static async cancelBooking(id: string) {
    const existing = await prisma.eventBooking.findUnique({ where: { id } });
    if (!existing) throw new Error('Event not found.');
    return prisma.eventBooking.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { eventSpace: true },
    });
  }

  static async deleteBooking(id: string) {
    const existing = await prisma.eventBooking.findUnique({ where: { id } });
    if (!existing) throw new Error('Event not found.');
    await prisma.eventBooking.delete({ where: { id } });
    return { deleted: true };
  }

  /** Fail fast when a booked event space already has an overlapping booking. */
  private static async assertSpaceAvailable(spaceId: string, startAt: Date, endAt: Date, excludeId?: string) {
    const overlap = await prisma.eventBooking.findFirst({
      where: {
        eventSpaceId: spaceId,
        status: { not: 'CANCELLED' },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (overlap) throw new Error(`${overlap.title} is already booked during that time for this space.`);
  }
}