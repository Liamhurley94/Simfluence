import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SelectionService {
  private _ids = signal<ReadonlySet<number>>(new Set());

  readonly ids = this._ids.asReadonly();
  readonly count = computed(() => this._ids().size);
  readonly hasAny = computed(() => this._ids().size > 0);

  has(id: number): boolean {
    return this._ids().has(id);
  }

  toggle(id: number): void {
    this._ids.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  add(id: number): void {
    this._ids.update((s) => {
      if (s.has(id)) return s;
      const next = new Set(s);
      next.add(id);
      return next;
    });
  }

  remove(id: number): void {
    this._ids.update((s) => {
      if (!s.has(id)) return s;
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  clear(): void {
    this._ids.set(new Set());
  }
}
