import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock('../src/config', () => ({ prisma: {
  $transaction: (...args: unknown[]) => mocks.transaction(...args),
  room: {}, guest: {}, reservation: {}, inventoryItem: {},
} }));
vi.mock('../src/services/audit.service', () => ({ AuditService: { logInTransaction: vi.fn(), log: vi.fn() } }));
import { ReservationService } from '../src/services/reservations.service';
import { InventoryService } from '../src/services/inventory.service';

describe('write-concurrency conflict safety', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('does not confirm a second overlapping reservation when serializable booking detects a race', async () => {
    mocks.transaction.mockRejectedValue({ code: 'P2034' });
    await expect(ReservationService.createReservation({
      guestId: 'guest-1', roomId: 'room-1', checkInDate: '2026-08-20', checkOutDate: '2026-08-22', createdBy: 'user-1',
    })).rejects.toMatchObject({ code: 'RESERVATION_CONFLICT', statusCode: 409 });
  });

  it('does not apply a second inventory deduction when serializable stock adjustment detects a race', async () => {
    mocks.transaction.mockRejectedValue({ code: 'P2034' });
    await expect(InventoryService.adjustStock('inventory-1', -1, 'F&B issue', 'user-1'))
      .rejects.toThrow('Inventory changed while this adjustment was being processed. Please retry.');
  });
});
