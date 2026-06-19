import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/theme/theme.service';
import { IconComponent } from '../../shared/icon/icon.component';

interface Plan {
  readonly name: string;
  readonly price: string;
  readonly cadence: string;
  readonly blurb: string;
  readonly features: readonly string[];
  readonly featured: boolean;
  readonly cta: string;
}

/**
 * Public pricing page (`/pricing`). Pulled off the landing per owner feedback —
 * pricing is now clicked-to, not inlined. Same Linear design language as the
 * landing: flat near-black canvas, hairline-bordered `.sf-card`s, one rationed
 * yellow accent on the single primary CTA, `var(--font-mono)` numerals.
 *
 * Tiers mirror prod but filtered to honest, shipped capabilities — persona /
 * audience-overlap / "learns over time" / API lines are deliberately omitted
 * pending compliance review.
 */
@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="min-h-screen" style="color: var(--color-text); background: var(--color-bg);">
      <!-- ============================ HEADER ============================ -->
      <header class="sticky top-0 z-30 border-b" style="background: var(--color-bg); border-color: var(--color-border);">
        <div class="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <a routerLink="/" class="flex items-center gap-2" aria-label="Simfluence home">
            <span class="inline-block w-6 h-6 rounded-lg" style="background-image: var(--gradient-brand);"></span>
            <span class="font-semibold text-lg tracking-tight" style="font-family: var(--font-display);">
              Simfluence
            </span>
          </a>

          <nav class="hidden md:flex items-center gap-7 text-sm" style="color: var(--color-text-dim);">
            <a routerLink="/" fragment="features" class="hover:opacity-80">Platform</a>
            <a routerLink="/" fragment="how" class="hover:opacity-80">How it works</a>
            <a routerLink="/pricing" class="hover:opacity-80" style="color: var(--color-text);">Pricing</a>
          </nav>

          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="theme.toggle()"
              class="sf-btn sf-btn-ghost !px-2.5"
              [attr.aria-label]="'Switch to ' + (theme.theme() === 'dark' ? 'light' : 'dark') + ' mode'"
              data-testid="theme-toggle"
            >
              <app-icon [name]="theme.theme() === 'dark' ? 'moon' : 'sun'" />
            </button>
            <a routerLink="/login" class="sf-btn sf-btn-ghost" data-testid="header-login">Log in</a>
          </div>
        </div>
      </header>

      <!-- ============================= INTRO =========================== -->
      <section class="mx-auto max-w-6xl px-5 pt-16 pb-10 md:pt-24 md:pb-12">
        <div class="max-w-2xl">
          <span class="sf-chip mb-5">Pricing</span>
          <h1
            class="font-semibold text-4xl md:text-5xl leading-[1.05]"
            style="font-family: var(--font-display); letter-spacing: -0.03em;"
            data-testid="pricing-headline"
          >
            Simple, transparent tiers.
          </h1>
          <p class="mt-5 text-lg" style="color: var(--color-text-dim);">
            Start small and scale up. Every plan includes CPI &amp; GFI scoring and
            P10 / P50 / P90 forecasts. All prices USD, excl. tax.
          </p>
        </div>
      </section>

      <!-- ============================ PLANS ============================ -->
      <section class="mx-auto max-w-6xl px-5 pb-16 md:pb-24">
        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          @for (p of plans; track p.name) {
            <div
              class="sf-card p-6 flex flex-col h-full"
              [style.box-shadow]="p.featured ? 'var(--shadow-glow)' : null"
            >
              @if (p.featured) {
                <span class="sf-chip self-start mb-3" style="color: var(--color-text);">Most popular</span>
              }
              <h2 class="font-semibold text-lg" style="font-family: var(--font-display);">{{ p.name }}</h2>
              <div class="mt-2 flex items-baseline gap-1">
                <span
                  class="text-3xl font-semibold"
                  style="font-family: var(--font-mono); font-variant-numeric: tabular-nums;"
                  >{{ p.price }}</span
                >
                <span class="text-sm" style="color: var(--color-text-muted);">{{ p.cadence }}</span>
              </div>
              <p class="mt-2 text-sm" style="color: var(--color-text-dim);">{{ p.blurb }}</p>
              <ul class="mt-5 space-y-2.5 text-sm flex-1" style="color: var(--color-text-dim);">
                @for (item of p.features; track item) {
                  <li class="flex gap-2.5 items-start">
                    <span class="mt-0.5 flex-none" style="color: var(--color-sf-green);">
                      <app-icon name="check" [size]="15" />
                    </span>
                    <span>{{ item }}</span>
                  </li>
                }
              </ul>
              <a
                routerLink="/login"
                [queryParams]="{ start: 'signup' }"
                class="sf-btn mt-6 w-full"
                [class.sf-btn-primary]="p.featured"
                [class.sf-btn-ghost]="!p.featured"
              >
                {{ p.cta }}
              </a>
            </div>
          }
        </div>

        <p class="mt-10 text-center text-sm" style="color: var(--color-text-muted);">
          Need a custom or enterprise plan?
          <a routerLink="/login" [queryParams]="{ start: 'signup' }" class="underline">Get in touch</a>.
        </p>
      </section>

      <!-- =========================== FOOTER ============================ -->
      <footer class="border-t" style="border-color: var(--color-border);">
        <div
          class="mx-auto max-w-6xl px-5 py-6 flex flex-wrap items-center justify-between gap-3 text-xs"
          style="color: var(--color-text-muted);"
        >
          <span>© {{ year }} Simfluence Ltd · All rights reserved</span>
          <a routerLink="/" class="hover:opacity-80">Back to home</a>
        </div>
      </footer>
    </div>
  `,
})
export class PricingComponent {
  protected theme = inject(ThemeService);
  protected readonly year = new Date().getFullYear();

  // Tiers mirror prod, filtered to honest shipped capabilities: persona/archetype,
  // audience-overlap, "learns over time" and API lines are intentionally removed.
  protected readonly plans: readonly Plan[] = [
    {
      name: 'Bronze',
      price: '$400',
      cadence: '/mo',
      blurb: 'For getting started with forecasting.',
      featured: false,
      cta: 'Get started',
      features: [
        '25 creator results per search',
        'CPI & GFI scores on every creator',
        '3 campaign simulations / month',
        'Outreach tracker (3 creators)',
        'Email support',
      ],
    },
    {
      name: 'Silver',
      price: '$1,000',
      cadence: '/mo',
      blurb: 'For brands running regular campaigns.',
      featured: false,
      cta: 'Get started',
      features: [
        '100 creator results',
        'Full CPI & GFI scores',
        '10 simulations / month',
        '3 saved campaign briefs',
        'Priority support',
      ],
    },
    {
      name: 'Gold',
      price: '$3,500',
      cadence: '/mo',
      blurb: 'For teams forecasting at scale.',
      featured: true,
      cta: 'Get started',
      features: [
        'Unlimited creator database',
        'Unlimited simulations',
        'Campaigns workspace (1 active brief)',
        'Budget split view & PDF summary',
        '10 saved briefs · CSV shortlist',
      ],
    },
    {
      name: 'Platinum',
      price: '$5,000',
      cadence: '/mo',
      blurb: 'For the highest-volume publishers.',
      featured: false,
      cta: 'Get started',
      features: [
        'Unlimited creator database',
        'Unlimited campaign briefs',
        'Full P10 / P50 / P90 PDF report',
        'Unlimited CSV export',
        'Direct line to the founder',
      ],
    },
  ];
}
