import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.body.classList.remove('light');
  });

  it('defaults to dark when nothing stored', () => {
    const service = TestBed.configureTestingModule({}).inject(ThemeService);
    expect(service.theme()).toBe('dark');
    expect(document.body.classList.contains('light')).toBe(false);
  });

  it('hydrates from stored theme', () => {
    localStorage.setItem('sf_theme', 'light');
    const service = TestBed.configureTestingModule({}).inject(ThemeService);
    expect(service.theme()).toBe('light');
    // effect runs on first change detection
    TestBed.flushEffects();
    expect(document.body.classList.contains('light')).toBe(true);
  });

  it('toggle flips dark → light → dark and persists', () => {
    const service = TestBed.configureTestingModule({}).inject(ThemeService);
    service.toggle();
    TestBed.flushEffects();
    expect(service.theme()).toBe('light');
    expect(localStorage.getItem('sf_theme')).toBe('light');
    expect(document.body.classList.contains('light')).toBe(true);

    service.toggle();
    TestBed.flushEffects();
    expect(service.theme()).toBe('dark');
    expect(localStorage.getItem('sf_theme')).toBe('dark');
    expect(document.body.classList.contains('light')).toBe(false);
  });
});