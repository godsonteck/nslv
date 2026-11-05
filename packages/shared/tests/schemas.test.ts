import { describe, expect, it } from 'vitest';
import {
  createRoomTypeSchema,
  emailSchema,
  resetSystemSchema,
} from '../src/validation/schemas';

describe('shared validation schemas', () => {
  it('coerces numeric strings and rejects non-numeric money values', () => {
    const parsed = createRoomTypeSchema.safeParse({ name: 'Deluxe', basePrice: '250.50' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.basePrice).toBe(250.5);

    const bad = createRoomTypeSchema.safeParse({ name: 'Deluxe', basePrice: 'not-a-number' });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues[0]?.path).toEqual(['basePrice']);
      expect(bad.error.issues[0]?.message).toBe('Must be a number');
    }
  });

  it('requires the exact reset confirmation text', () => {
    const bad = resetSystemSchema.safeParse({ confirmText: 'reset', password: 'x' });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues[0]?.message).toBe('Type RESET to confirm');
    }

    expect(resetSystemSchema.safeParse({ confirmText: 'RESET', password: 'x' }).success).toBe(true);
  });

  it('normalises email casing and rejects malformed addresses', () => {
    expect(emailSchema.parse('  Admin@NSVilla.COM ')).toBe('admin@nsvilla.com');

    const bad = emailSchema.safeParse('not-an-email');
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues[0]?.message).toBe('Please enter a valid email address');
    }
  });
});
