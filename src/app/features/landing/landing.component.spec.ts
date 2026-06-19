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

  it('renders one primary call-to-action routing to the signup form', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const cta: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      '[data-testid="hero-cta-primary"]',
    );
    expect(cta).toBeTruthy();
    expect(cta?.textContent?.trim()).toContain('Get started');
    // Distinct destination from the quiet "Log in" link — opens the signup tab.
    expect(cta?.getAttribute('href')).toBe('/login?start=signup');
  });

  it('has a single quiet log-in link that goes to the sign-in form (no circular CTA)', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const login: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      '[data-testid="header-login"]',
    );
    expect(login).toBeTruthy();
    expect(login?.textContent?.trim()).toBe('Log in');
    // Plain /login (sign-in) — distinct role + destination from the primary CTA.
    expect(login?.getAttribute('href')).toBe('/login');

    // The old design shipped a duplicate "Launch app" header button that pointed
    // at the same place as "Log in". It must not exist anymore.
    const text = (fixture.nativeElement.textContent ?? '').toLowerCase();
    expect(text).not.toContain('launch app');
  });

  it('does not inline pricing — it only links out to /pricing', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    // No inline price points (e.g. the old "$3,500/mo" tier cards).
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).not.toContain('$3,500');
    expect(text).not.toContain('/mo');
    // But a Pricing link to the dedicated page is present.
    const pricingLink = Array.from(
      fixture.nativeElement.querySelectorAll('a'),
    ).find((a) => (a as HTMLAnchorElement).getAttribute('href') === '/pricing');
    expect(pricingLink).toBeTruthy();
  });

  it('uses the icon component instead of emoji glyphs', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const icons = fixture.nativeElement.querySelectorAll('app-icon');
    expect(icons.length).toBeGreaterThan(0);
    // No leftover emoji in the rendered output.
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).not.toMatch(/[🔎📊🎯🧪🗂️✉️✓🌙☀️]/u);
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
