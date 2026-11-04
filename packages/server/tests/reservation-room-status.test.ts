import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  reservationFindFirst: vi.fn(),
  roomFindUnique: vi.fn(),
  guestFindUnique: vi.fn(),
  reservationCreate: vi.fn(),
  roomUpdate: vi.fn(),
  userFindMany: vi.fn(),
  notificationCreateMany: vi.fn(),
}));

vi.mock('../src/config', () => ({
  prisma: {
    $transaction: mocks.transaction,
    user: { findMany: mocks.userFindMany },
    notification: { createMany: mocks.notificationCreateMany },
  },
}));

import { ReservationService } from '../src/services/reservations.service';

describe('reservation room status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const tx = {
      reservation: { findFirst: mocks.reservationFindFirst, create: mocks.reservationCreate },
      room: { findUnique: mocks.roomFindUnique, update: mocks.roomUpdate },
      guest: { findUnique: mocks.guestFindUnique },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    mocks.reservationFindFirst.mockResolvedValue(null);
    mocks.roomFindUnique.mockResolvedValue({
      id: 'room-1', isActive: true, status: 'AVAILABLE', roomType: { basePrice: 250 },
    });
    mocks.guestFindUnique.mockResolvedValue({ id: 'guest-1' });
    mocks.reservationCreate.mockResolvedValue({ id: 'reservation-1' });
    mocks.roomUpdate.mockResolvedValue({});
    mocks.userFindMany.mockResolvedValue([]);
    mocks.notificationCreateMany.mockResolvedValue({ count: 0 });
  });

  it('leaves the room available for a future reservation but reserves it for today', async () => {
    await ReservationService.createReservation({
      guestId: 'guest-1', roomId: 'room-1', checkInDate: '2030-10-10', checkOutDate: '2030-10-12',
    });

    // A future booking must not take the room out of today's sellable pool;
    // availability is computed from overlapping reservations instead.
    expect(mocks.roomUpdate).not.toHaveBeenCalled();

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await ReservationService.createReservation({
      guestId: 'guest-1', roomId: 'room-1', checkInDate: today, checkOutDate: tomorrow,
    });

    expect(mocks.roomUpdate).toHaveBeenCalledWith({
      where: { id: 'room-1' }, data: { status: 'RESERVED' },
    });
  });
});
