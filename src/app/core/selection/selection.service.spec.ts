import { describe, expect, it } from 'vitest';
import { SelectionService } from './selection.service';

describe('SelectionService', () => {
  it('starts empty', () => {
    const svc = new SelectionService();
    expect(svc.count()).toBe(0);
    expect(svc.hasAny()).toBe(false);
    expect(svc.has(1)).toBe(false);
  });

  it('toggle adds then removes', () => {
    const svc = new SelectionService();
    svc.toggle(42);
    expect(svc.has(42)).toBe(true);
    expect(svc.count()).toBe(1);
    svc.toggle(42);
    expect(svc.has(42)).toBe(false);
    expect(svc.count()).toBe(0);
  });

  it('add is idempotent; remove is safe for missing ids', () => {
    const svc = new SelectionService();
    svc.add(1);
    svc.add(1);
    expect(svc.count()).toBe(1);
    svc.remove(999);
    expect(svc.count()).toBe(1);
    svc.remove(1);
    expect(svc.count()).toBe(0);
  });

  it('clear wipes all selections', () => {
    const svc = new SelectionService();
    svc.add(1);
    svc.add(2);
    svc.add(3);
    expect(svc.count()).toBe(3);
    svc.clear();
    expect(svc.count()).toBe(0);
    expect(svc.hasAny()).toBe(false);
  });

  it('ids signal updates on mutation', () => {
    const svc = new SelectionService();
    const before = svc.ids();
    svc.add(1);
    const after = svc.ids();
    expect(after).not.toBe(before);
    expect(after.has(1)).toBe(true);
  });
});
