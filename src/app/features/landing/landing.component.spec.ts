import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the hero headline', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const headline = fixture.nativeElement.querySelector('[data-testid="hero-headline"]');
    expect(headline).toBeTruthy();
    expect(headline.textContent).toContain('Know');
    expect(headline.textContent).toContain('before you spend');
  });

  it('renders a primary call-to-action routing to login', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const cta: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      '[data-testid="hero-cta-primary"]',
    );
    expect(cta).toBeTruthy();
    expect(cta?.textContent?.trim()).toBe('Get started free');
    expect(cta?.getAttribute('href')).toBe('/login');
  });

  it('omits AI-persona / audience-demographic marketing claims', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement.textContent ?? '').toLowerCase();
    expect(text).not.toContain('persona');
    expect(text).not.toContain('audience overlap');
    expect(text).not.toContain('demographic');
  });
});
