import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private memory = new Map<string, string>();

  getItem(key: string): string | null {
    try {
      const v = localStorage.getItem(key);
      if (v !== null) return v;
    } catch {
      /* localStorage unavailable */
    }
    try {
      const v = sessionStorage.getItem(key);
      if (v !== null) return v;
    } catch {
      /* sessionStorage unavailable */
    }
    return this.memory.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
      return;
    } catch {
      /* fall through */
    }
    try {
      sessionStorage.setItem(key, value);
      return;
    } catch {
      /* fall through */
    }
    this.memory.set(key, value);
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    this.memory.delete(key);
  }
}