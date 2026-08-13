import { describe, expect, it } from 'vitest';
import { RESET_WIPE_ORDER } from './system.service';

describe('system reset wipe order', () => {
  it('includes category records in the wipe order while preserving admin identity data', () => {
    expect(RESET_WIPE_ORDER).toContain('itemCategory');
    expect(RESET_WIPE_ORDER).not.toContain('user');
    expect(RESET_WIPE_ORDER).not.toContain('role');
    expect(RESET_WIPE_ORDER).not.toContain('userRole');
    expect(RESET_WIPE_ORDER).not.toContain('rolePermission');
  });
});
