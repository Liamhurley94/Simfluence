import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { PricingComponent } from './pricing.component';

describe('PricingComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PricingComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the pricing headline', () => {
    const fixture = TestBed.createComponent(PricingComponent);
    fixture.detectChanges();
    const headline = fixture.nativeElement.querySelector('[data-testid="pricing-headline"]');
    expect(headline).toBeTruthy();
    expect(headline.textContent?.toLowerCase()).toContain('tiers');
  });

  it('lists the four tiers with their prices', () => {
    const fixture = TestBed.createComponent(PricingComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent ?? '';
    for (const tier of ['Bronze', 'Silver', 'Gold', 'Platinum']) {
      expect(text).toContain(tier);
    }
    expect(text).toContain('$3,500');
  });

  it('omits AI-persona / audience-demographic marketing claims', () => {
    const fixture = TestBed.createComponent(PricingComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement.textContent ?? '').toLowerCase();
    expect(text).not.toContain('persona');
    expect(text).not.toContain('audience overlap');
    expect(text).not.toContain('demographic');
    expect(text).not.toContain('api');
  });

  it('uses the icon component for the feature checkmarks (no emoji)', () => {
    const fixture = TestBed.createComponent(PricingComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-icon').length).toBeGreaterThan(0);
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).not.toMatch(/[✓🌙☀️]/u);
  });
});
