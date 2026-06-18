import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/theme/theme.service';
import { ScrollRevealDirective } from './scroll-reveal.directive';
import { CountUpDirective } from './count-up.directive';

interface Feature {
  readonly icon: string; // single-char glyph / emoji used as a lightweight icon
  readonly title: string;
  readonly body: string;
  readonly meta: string;
}

interface Step {
  readonly n: string;
  readonly title: string;
  readonly body: string;
}

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
 * Public, pre-auth marketing landing page. Wired to the root route (`/`) so
 * unauthenticated visitors land here rather than being bounced to /login.
 * Reuses the app's design tokens + .sf-* classes; motion lives in the sibling
 * CSS file and is gated behind prefers-reduced-motion.
 *
 * Content note: AI-persona / audience-demographic / audience-overlap / "model
 * learns over time" / API claims are deliberately omitted pending compliance
 * review — only shipped, truthful capabilities are marketed here.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, ScrollRevealDirective, CountUpDirective],
  styleUrl: './landing.component.css',
  template: `
    <div class="min-h-screen overflow-x-hidden" style="color: var(--color-text);">
      <!-- ============================ HEADER ============================ -->
      <header
        class="sticky top-0 z-30 backdrop-blur-md border-b"
        style="background: color-mix(in srgb, var(--color-bg) 78%, transparent); border-color: var(--color-border);"
      >
        <div class="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <a routerLink="/" class="flex items-center gap-2" aria-label="Simfluence home">
            <span
              class="inline-block w-6 h-6 rounded-lg"
              style="background-image: var(--gradient-brand);"
            ></span>
            <span
              class="font-bold text-lg tracking-tight"
              style="font-family: var(--font-display);"
            >
              Simfluence
            </span>
          </a>

          <nav
            class="hidden md:flex items-center gap-7 text-sm"
            style="color: var(--color-text-dim);"
          >
            <a href="#features" class="hover:opacity-80">Platform</a>
            <a href="#how" class="hover:opacity-80">How it works</a>
            <a href="#pricing" class="hover:opacity-80">Pricing</a>
          </nav>

          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="theme.toggle()"
              class="sf-btn sf-btn-ghost !px-2.5"
              [attr.aria-label]="
                'Switch to ' + (theme.theme() === 'dark' ? 'light' : 'dark') + ' mode'
              "
              data-testid="theme-toggle"
            >
              {{ theme.theme() === 'dark' ? '🌙' : '☀️' }}
            </button>
            <a
              routerLink="/login"
              class="sf-btn sf-btn-ghost hidden sm:inline-flex"
              data-testid="header-login"
            >
              Log in
            </a>
            <a routerLink="/login" class="sf-btn sf-btn-primary" data-testid="header-cta">
              Launch app
            </a>
          </div>
        </div>
      </header>

      <!-- ============================= HERO ============================= -->
      <section class="relative isolate">
        <div class="sf-hero-mesh" aria-hidden="true"></div>
        <div class="sf-hero-grid" aria-hidden="true"></div>

        <div class="relative z-10 mx-auto max-w-6xl px-5 pt-20 pb-16 md:pt-28 md:pb-24">
          <div class="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
            <!-- Copy -->
            <div sfScrollReveal>
              <span class="sf-chip mb-5">Campaign intelligence for influencer marketing</span>
              <h1
                class="font-bold leading-[1.05] tracking-tight text-4xl sm:text-5xl md:text-6xl"
                style="font-family: var(--font-display);"
                data-testid="hero-headline"
              >
                Know <span class="sf-grad-text">before</span> you spend.
              </h1>
              <p class="mt-5 text-lg max-w-xl" style="color: var(--color-text-dim);">
                Forecast a creator campaign's reach and cost before a single dollar is committed —
                with P10 / P50 / P90 confidence bands. Model it, see the range, launch with a
                benchmark.
              </p>

              <div class="mt-8 flex flex-wrap gap-3">
                <a
                  routerLink="/login"
                  class="sf-btn sf-btn-primary !px-6 !py-3 text-base"
                  data-testid="hero-cta-primary"
                >
                  Get started free
                </a>
                <a
                  href="#how"
                  class="sf-btn sf-btn-ghost !px-6 !py-3 text-base"
                  data-testid="hero-cta-secondary"
                >
                  See how it works
                </a>
              </div>

              <p class="mt-4 text-xs" style="color: var(--color-text-muted);">
                No card required to explore. Forecasts are estimates, not guarantees.
              </p>
            </div>

            <!-- Animated visual: floating stat cards + a drawn forecast chart -->
            <div class="relative h-[360px] sm:h-[420px]" aria-hidden="true">
              <!-- Forecast chart card -->
              <div class="sf-card sf-float p-5 absolute inset-x-0 top-6 mx-auto max-w-sm">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-semibold" style="color: var(--color-text-dim);"
                    >Forecast · Impressions</span
                  >
                  <span class="sf-chip">P10–P90</span>
                </div>
                <svg viewBox="0 0 320 120" class="w-full h-[120px]" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="sfArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="var(--color-sf-cyan)" stop-opacity="0.35" />
                      <stop offset="100%" stop-color="var(--color-sf-blue)" stop-opacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    class="sf-chart-area"
                    d="M0,95 C60,80 90,50 140,55 C190,60 230,25 320,18 L320,120 L0,120 Z"
                    fill="url(#sfArea)"
                  />
                  <path
                    class="sf-chart-line"
                    d="M0,95 C60,80 90,50 140,55 C190,60 230,25 320,18"
                    fill="none"
                    stroke="var(--color-sf-cyan)"
                    stroke-width="2.5"
                    stroke-linecap="round"
                  />
                </svg>
                <div
                  class="mt-2 flex justify-between text-xs"
                  style="color: var(--color-text-muted); font-family: var(--font-mono);"
                >
                  <span>4.2M</span><span>5.1M</span><span>5.8M</span>
                </div>
              </div>

              <!-- CPI score card -->
              <div class="sf-card sf-float sf-float-delay p-4 absolute left-0 bottom-2 w-40">
                <div class="text-xs" style="color: var(--color-text-muted);">CPI score</div>
                <div
                  class="text-3xl font-bold"
                  style="font-family: var(--font-mono); color: var(--color-sf-green);"
                >
                  87
                </div>
                <div class="text-[11px]" style="color: var(--color-text-dim);">
                  cost-per-impression
                </div>
              </div>

              <!-- GFI score card -->
              <div class="sf-card sf-float-slow p-4 absolute right-0 bottom-10 w-40">
                <div class="text-xs" style="color: var(--color-text-muted);">GFI score</div>
                <div
                  class="text-3xl font-bold"
                  style="font-family: var(--font-mono); color: var(--color-sf-gold);"
                >
                  92
                </div>
                <div class="text-[11px]" style="color: var(--color-text-dim);">genre fit</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ====================== PROBLEM / STATS ======================== -->
      <section class="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div sfScrollReveal class="text-center max-w-2xl mx-auto">
          <h2
            class="font-bold text-3xl md:text-4xl tracking-tight"
            style="font-family: var(--font-display);"
          >
            Brands spend before they <span class="sf-grad-text">know</span>.
          </h2>
          <p class="mt-4" style="color: var(--color-text-dim);">
            Influencer budgets are still committed on gut feel — and the result only shows up weeks
            after the money is gone. Simfluence puts a forecast in front of the spend.
          </p>
        </div>

        <div class="mt-12 grid sm:grid-cols-3 gap-5">
          @for (stat of stats; track stat.label) {
            <div
              sfScrollReveal
              class="sf-card p-7 text-center"
              [style.transition-delay.ms]="$index * 100"
            >
              <div
                class="text-4xl md:text-5xl font-bold"
                style="font-family: var(--font-mono); color: var(--color-sf-blue);"
              >
                <span
                  [sfCountUp]="stat.value"
                  [prefix]="stat.prefix"
                  [suffix]="stat.suffix"
                  [decimals]="stat.decimals"
                  >{{ stat.prefix }}0{{ stat.suffix }}</span
                >
              </div>
              <div class="mt-2 text-sm" style="color: var(--color-text-dim);">{{ stat.label }}</div>
            </div>
          }
        </div>
      </section>

      <!-- ========================= FEATURES ============================ -->
      <section id="features" class="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div sfScrollReveal class="text-center max-w-2xl mx-auto mb-12">
          <span class="sf-chip mb-4">The platform</span>
          <h2
            class="font-bold text-3xl md:text-4xl tracking-tight"
            style="font-family: var(--font-display);"
          >
            Built to replace <span class="sf-grad-text">guesswork</span>.
          </h2>
          <p class="mt-4" style="color: var(--color-text-dim);">
            Discover the right creators, score them on what they deliver, and forecast the outcome —
            all in one workspace.
          </p>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (f of features; track f.title) {
            <div
              sfScrollReveal
              class="sf-card sf-lift p-6"
              [style.transition-delay.ms]="$index * 80"
            >
              <div
                class="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4"
                style="background-image: var(--gradient-brand-soft); border: 1px solid var(--color-border);"
                aria-hidden="true"
              >
                {{ f.icon }}
              </div>
              <h3 class="font-semibold text-lg" style="font-family: var(--font-display);">
                {{ f.title }}
              </h3>
              <p class="mt-2 text-sm leading-relaxed" style="color: var(--color-text-dim);">
                {{ f.body }}
              </p>
              <div
                class="mt-4 text-xs font-medium"
                style="color: var(--color-text-muted); font-family: var(--font-mono);"
              >
                {{ f.meta }}
              </div>
            </div>
          }
        </div>
      </section>

      <!-- ======================= HOW IT WORKS ========================= -->
      <section id="how" class="relative">
        <div class="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div sfScrollReveal class="text-center max-w-2xl mx-auto mb-12">
            <span class="sf-chip mb-4">How it works</span>
            <h2
              class="font-bold text-3xl md:text-4xl tracking-tight"
              style="font-family: var(--font-display);"
            >
              Brief to forecast in <span class="sf-grad-text">minutes</span>.
            </h2>
          </div>

          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            @for (s of steps; track s.n) {
              <div sfScrollReveal class="sf-panel p-6" [style.transition-delay.ms]="$index * 90">
                <div
                  class="text-sm font-bold w-8 h-8 rounded-lg flex items-center justify-center mb-4"
                  style="background-image: var(--gradient-brand); color: #fff; font-family: var(--font-mono);"
                >
                  {{ s.n }}
                </div>
                <h3 class="font-semibold" style="font-family: var(--font-display);">
                  {{ s.title }}
                </h3>
                <p class="mt-2 text-sm" style="color: var(--color-text-dim);">{{ s.body }}</p>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- ========================== PRICING =========================== -->
      <section id="pricing" class="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div sfScrollReveal class="text-center max-w-2xl mx-auto mb-12">
          <span class="sf-chip mb-4">Pricing</span>
          <h2
            class="font-bold text-3xl md:text-4xl tracking-tight"
            style="font-family: var(--font-display);"
          >
            Simple. <span class="sf-grad-text">Transparent.</span>
          </h2>
          <p class="mt-4" style="color: var(--color-text-dim);">
            Tiers for every scale of brand. Start small, scale up. All prices USD, excl. tax.
          </p>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          @for (p of plans; track p.name) {
            <div
              sfScrollReveal
              class="sf-card sf-lift p-6 flex flex-col h-full"
              [style.transition-delay.ms]="$index * 70"
              [style.border-color]="p.featured ? 'var(--color-border-strong)' : null"
            >
              @if (p.featured) {
                <span class="sf-chip self-start mb-3" style="color: var(--color-text);"
                  >Most popular</span
                >
              }
              <h3 class="font-semibold text-lg" style="font-family: var(--font-display);">
                {{ p.name }}
              </h3>
              <div class="mt-2 flex items-baseline gap-1">
                <span class="text-3xl font-bold" style="font-family: var(--font-mono);">{{
                  p.price
                }}</span>
                <span class="text-sm" style="color: var(--color-text-muted);">{{ p.cadence }}</span>
              </div>
              <p class="mt-2 text-sm" style="color: var(--color-text-dim);">{{ p.blurb }}</p>
              <ul class="mt-5 space-y-2 text-sm flex-1" style="color: var(--color-text-dim);">
                @for (item of p.features; track item) {
                  <li class="flex gap-2">
                    <span style="color: var(--color-sf-green);" aria-hidden="true">✓</span>
                    <span>{{ item }}</span>
                  </li>
                }
              </ul>
              <a
                routerLink="/login"
                class="sf-btn mt-6 w-full"
                [class.sf-btn-primary]="p.featured"
                [class.sf-btn-ghost]="!p.featured"
              >
                {{ p.cta }}
              </a>
            </div>
          }
        </div>

        <p class="mt-8 text-center text-xs" style="color: var(--color-text-muted);">
          Need a custom or enterprise plan?
          <a routerLink="/login" class="underline">Get in touch</a>.
        </p>
      </section>

      <!-- ======================== CLOSING CTA ========================= -->
      <section class="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div
          sfScrollReveal
          class="sf-card relative overflow-hidden text-center px-6 py-16"
          style="background-image: var(--gradient-brand-soft);"
        >
          <div class="sf-hero-mesh" aria-hidden="true" style="opacity: 0.6;"></div>
          <div class="relative z-10 max-w-2xl mx-auto">
            <h2
              class="font-bold text-3xl md:text-4xl tracking-tight"
              style="font-family: var(--font-display);"
            >
              Your next campaign already has a <span class="sf-grad-text">forecast</span>.
            </h2>
            <p class="mt-4" style="color: var(--color-text-dim);">
              Run your brief. See the range. Launch knowing what to expect.
            </p>
            <a
              routerLink="/login"
              class="sf-btn sf-btn-primary !px-7 !py-3 text-base mt-8"
              data-testid="closing-cta"
            >
              Get started free
            </a>
          </div>
        </div>
      </section>

      <!-- ========================== FOOTER ============================ -->
      <footer class="border-t" style="border-color: var(--color-border);">
        <div class="mx-auto max-w-6xl px-5 py-12 grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div class="flex items-center gap-2 mb-3">
              <span
                class="inline-block w-5 h-5 rounded-md"
                style="background-image: var(--gradient-brand);"
              ></span>
              <span class="font-bold" style="font-family: var(--font-display);">Simfluence</span>
            </div>
            <p class="text-sm max-w-xs" style="color: var(--color-text-muted);">
              Campaign intelligence for influencer marketing. Forecast reach and cost before you
              spend.
            </p>
          </div>

          <div class="text-sm">
            <div class="font-semibold mb-3" style="color: var(--color-text-dim);">Platform</div>
            <ul class="space-y-2" style="color: var(--color-text-muted);">
              <li><a href="#features" class="hover:opacity-80">Creator discovery</a></li>
              <li><a href="#features" class="hover:opacity-80">CPI &amp; GFI scoring</a></li>
              <li><a href="#features" class="hover:opacity-80">Campaign simulator</a></li>
              <li><a href="#pricing" class="hover:opacity-80">Pricing</a></li>
            </ul>
          </div>

          <div class="text-sm">
            <div class="font-semibold mb-3" style="color: var(--color-text-dim);">Get started</div>
            <ul class="space-y-2" style="color: var(--color-text-muted);">
              <li><a routerLink="/login" class="hover:opacity-80">Log in</a></li>
              <li><a routerLink="/login" class="hover:opacity-80">Create account</a></li>
            </ul>
          </div>
        </div>

        <div class="border-t" style="border-color: var(--color-border);">
          <div
            class="mx-auto max-w-6xl px-5 py-5 flex flex-wrap items-center justify-between gap-3 text-xs"
            style="color: var(--color-text-muted);"
          >
            <span>© {{ year }} Simfluence Ltd · All rights reserved</span>
            <span class="sf-chip">Confidential</span>
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class LandingComponent {
  protected theme = inject(ThemeService);
  protected readonly year = new Date().getFullYear();

  protected readonly stats: ReadonlyArray<{
    value: number;
    prefix: string;
    suffix: string;
    decimals: number;
    label: string;
  }> = [
    {
      value: 68,
      prefix: '',
      suffix: '%',
      decimals: 0,
      label: 'of influencer campaigns underperform against forecast',
    },
    {
      value: 340,
      prefix: '$',
      suffix: 'K',
      decimals: 0,
      label: 'wasted per year by the average publisher on missed campaigns',
    },
    {
      value: 90,
      prefix: 'P',
      suffix: '',
      decimals: 0,
      label: 'confidence bands — P10 / P50 / P90 on every forecast',
    },
  ];

  protected readonly features: readonly Feature[] = [
    {
      icon: '🔎',
      title: 'Creator discovery',
      body: 'Find creators by what they will deliver, not by follower count. Thousands of creators across YouTube, Twitch and more — searchable by genre, platform and region.',
      meta: 'YouTube · Twitch · multi-platform',
    },
    {
      icon: '📊',
      title: 'CPI & GFI scoring',
      body: 'Two scores follower count never could. The Simfluence CPI rates cost-per-impression efficiency; the GFI measures genre fit between a creator and your campaign.',
      meta: '0–100 scale · per-creator',
    },
    {
      icon: '🎯',
      title: 'Campaign forecasting',
      body: 'Forecast reach and cost with P10 / P50 / P90 confidence bands — so you see the likely range, not a single optimistic number, before you commit budget.',
      meta: 'P10 / P50 / P90 bands',
    },
    {
      icon: '🧪',
      title: 'What-if simulator',
      body: 'Swap creators in and out, adjust budget, and re-run the forecast instantly to compare scenarios before you settle on a shortlist.',
      meta: 'budget & creator what-ifs',
    },
    {
      icon: '🗂️',
      title: 'Campaign workspace',
      body: 'Save briefs, build a shortlist, and keep your forecast alongside the plan — one place for the whole campaign, not a scatter of spreadsheets.',
      meta: 'briefs · shortlists',
    },
    {
      icon: '✉️',
      title: 'Outreach tracker',
      body: 'Track which creators you have reached out to and where each conversation stands, straight from the shortlist you built.',
      meta: 'outreach status',
    },
  ];

  protected readonly steps: readonly Step[] = [
    {
      n: '1',
      title: 'Input your brief',
      body: 'Genre, region, platforms, budget and objectives. No lengthy onboarding.',
    },
    {
      n: '2',
      title: 'Discover creators',
      body: 'Browse by CPI and GFI score. Filter by tier, platform and region.',
    },
    {
      n: '3',
      title: 'Run the simulation',
      body: 'Get probabilistic forecasts with P10, P50 and P90 confidence bands.',
    },
    {
      n: '4',
      title: 'Launch with a benchmark',
      body: 'Know the expected range before you spend. Brief your team with confidence.',
    },
  ];

  // Pricing mirrors prod tiers, but filtered to honest, shipped capabilities:
  // persona/archetype, audience-overlap, "learns over time" and API lines removed.
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
