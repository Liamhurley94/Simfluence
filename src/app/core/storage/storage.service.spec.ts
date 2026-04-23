import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    service = new StorageService();
  });

  it('writes and reads from localStorage by default', () => {
    service.setItem('k', 'v');
    expect(localStorage.getItem('k')).toBe('v');
    expect(service.getItem('k')).toBe('v');
  });

  it('removes from all stores', () => {
    service.setItem('k', 'v');
    service.removeItem('k');
    expect(localStorage.getItem('k')).toBeNull();
    expect(service.getItem('k')).toBeNull();
  });

  it('falls back to sessionStorage when localStorage throws', () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('localStorage unavailable');
    });
    service.setItem('k', 'v');
    expect(sessionStorage.getItem('k')).toBe('v');
    setSpy.mockRestore();
  });

  it('falls back to memory when both storage APIs throw', () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    service.setItem('k', 'v');
    expect(service.getItem('k')).toBe('v');

    setSpy.mockRestore();
    getSpy.mockRestore();
  });

  it('returns null for unknown keys', () => {
    expect(service.getItem('nope')).toBeNull();
  });
});