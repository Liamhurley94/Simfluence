import { Injectable, effect, inject, signal } from '@angular/core';
import { StorageService } from '../storage/storage.service';

export type Theme = 'dark' | 'light';

const KEY = 'sf_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private storage = inject(StorageService);
  readonly theme = signal<Theme>(this.readInitial());

  constructor() {
    effect(() => {
      const t = this.theme();
      if (typeof document !== 'undefined') {
        document.body.classList.toggle('light', t === 'light');
      }
      this.storage.setItem(KEY, t);
    });
  }

  toggle(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  set(theme: Theme): void {
    this.theme.set(theme);
  }

  private readInitial(): Theme {
    const stored = this.storage.getItem(KEY);
    return stored === 'light' ? 'light' : 'dark';
  }
}