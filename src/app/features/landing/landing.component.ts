import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/theme/theme.service';
import { IconComponent, IconName } from '../../shared/icon/icon.component';
import { ScrollRevealDirective } from './scroll-reveal.directive';
import { CountUpDirective } from './count-up.directive';

interface Feature {
  readonly icon: IconName;
  readonly title: string;
  readonly body: string;
  readonly meta: string;
}

interface Step {
  readonly n: string;
  readonly title: string;
  readonly body: string;
}

/**
 * Public, pre-auth marketing landing page. Wired to the root route (`/`) so
 * unauthenticated visitors land here rather than being bounced to /login.
 * Reuses the app's Linear design language (.sf-* classes + tokens). Motion lives
 * in the sibling CSS file and is gated behind prefers-reduced-motion.
 *
 * CTA model (owner feedback — no "circular" duplicate buttons): the nav has ONE
 * quiet ghost "Log in" → /login (sign-in form); the hero has ONE primary yellow
 * "Get started" → /login?start=signup (signup form). Distinct roles, distinct
 * destinations.
 *
 * Content note: AI-persona / audience-demographic / audience-overlap / "model
 * learns over time" / API claims are deliberately omitted pending compliance
 * review — only shipped, truthful capabilities are marketed here. Pricing lives
 * on a separate /pricing page, not inlined here.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, IconComponent, ScrollRevealDirective, CountUpDirective],
  styleUrl: './landing.component.css',
  template: `
    <div class="min-h-screen overflow-x-hidden" style="color: var(--color-text); background: var(--color-bg);">
      <!-- ============================ HEADER ============================ -->
      <header
        class="sticky top-0 z-30 border-b"
        style="background: var(--color-bg); border-color: var(--color-border);"
      >
        <div class="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <a routerLink="/" class="flex items-center gap-2" aria-label="Simfluence home">
            <span
              class="inline-block w-6 h-6 rounded-lg"
              style="background-image: var(--gradient-brand);"
            ></span>
            <span class="font-semibold text-lg tracking-tight" style="font-family: var(--font-display);">
              Simfluence
            </span>
          </a>

          <nav class="hidden md:flex items-center gap-7 text-sm" style="color: var(--color-text-dim);">
            <a href="#features" class="hover:opacity-80">Platform</a>
            <a href="#how" class="hover:opacity-80">How it works</a>
            <a routerLink="/pricing" class="hover:opacity-80">Pricing</a>
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
              <app-icon [name]="theme.theme() === 'dark' ? 'moon' : 'sun'" />
            </button>
            <!-- Single quiet auth link → sign-in form. -->
            <a routerLink="/login" class="sf-btn sf-btn-ghost" data-testid="header-login">
              Log in
            </a>
          </div>
        </div>
      </header>

      <!-- ============================= HERO ============================= -->
      <section class="mx-auto max-w-6xl px-5 pt-16 pb-16 md:pt-24 md:pb-24">
        <div class="grid lg:grid-cols-[1.02fr_0.98fr] gap-12 lg:gap-14 items-center">
          <!-- Copy -->
          <div sfScrollReveal>
            <span class="sf-chip mb-6">Campaign intelligence for influencer marketing</span>
            <h1
              class="font-semibold leading-[1.04] text-4xl sm:text-5xl md:text-6xl"
              style="font-family: var(--font-display); letter-spacing: -0.035em;"
              data-testid="hero-headline"
            >
              Know <span class="sf-grad-text">before</span> you spend.
            </h1>
            <p class="mt-6 text-lg max-w-xl" style="color: var(--color-text-dim);">
              Forecast a creator campaign's reach and cost before a single dollar is committed —
              with P10 / P50 / P90 confidence bands. Model it, see the range, launch with a
              benchmark.
            </p>

            <!-- Single primary CTA → signup form. -->
            <div class="mt-8 flex flex-wrap gap-3 items-center">
              <a
                routerLink="/login"
                [queryParams]="{ start: 'signup' }"
                class="sf-btn sf-btn-primary !px-6 !py-3 text-base"
                data-testid="hero-cta-primary"
              >
                Get started
                <app-icon name="arrow-right" [size]="17" />
              </a>
              <a href="#how" class="sf-btn sf-btn-ghost !px-6 !py-3 text-base" data-testid="hero-cta-secondary">
                See how it works
              </a>
            </div>

            <p class="mt-4 text-xs" style="color: var(--color-text-muted);">
              No card required to explore. Forecasts are estimates, not guarantees.
            </p>
          </div>

          <!-- Product-as-hero: a faithful static showcase of the app's own UI, built
               in the real design language (hairline .sf-cards, mono numerals). -->
          <div sfScrollReveal class="relative" aria-hidden="true">
            <div class="sf-card sf-product-shell p-4 sm:p-5">
              <!-- Chrome row -->
              <div class="flex items-center justify-between mb-4">
                <span class="sf-chip">Campaign forecast</span>
                <span class="text-[11px]" style="color: var(--color-text-muted); font-family: var(--font-mono);">
                  /app/simulator
                </span>
              </div>

              <!-- Creator card + score tiles -->
              <div class="grid grid-cols-[1fr_auto] gap-3">
                <div class="sf-panel p-4">
                  <div class="flex items-center gap-3">
                    <span
                      class="w-9 h-9 rounded-full flex-none flex items-center justify-center text-sm font-semibold"
                      style="background: var(--color-bg-4); color: var(--color-text-dim); font-family: var(--font-mono);"
                    >NW</span>
                    <div class="min-w-0">
                      <div class="text-sm font-semibold truncate">Northwind Gaming</div>
                      <div class="text-[11px]" style="color: var(--color-text-muted);">
                        YouTube · Gaming · 1.4M subs
                      </div>
                    </div>
                  </div>
                  <div class="mt-3 grid grid-cols-2 gap-2">
                    <div class="sf-panel px-3 py-2" style="background: var(--color-bg-3);">
                      <div class="text-[10px] uppercase tracking-wide" style="color: var(--color-text-muted);">CPI</div>
                      <div class="text-xl font-semibold" style="font-family: var(--font-mono); color: var(--color-sf-green);">87</div>
                    </div>
                    <div class="sf-panel px-3 py-2" style="background: var(--color-bg-3);">
                      <div class="text-[10px] uppercase tracking-wide" style="color: var(--color-text-muted);">GFI</div>
                      <div class="text-xl font-semibold" style="font-family: var(--font-mono); color: var(--color-sf-gold);">92</div>
                    </div>
                  </div>
                </div>

                <!-- Headline metric tile -->
                <div class="sf-panel p-4 flex flex-col justify-center text-center w-32" style="background: var(--color-bg-3);">
                  <div class="text-[10px] uppercase tracking-wide" style="color: var(--color-text-muted);">P50 reach</div>
                  <div class="text-2xl font-semibold leading-none mt-1" style="font-family: var(--font-mono);">5.1M</div>
                  <div class="text-[10px] mt-1" style="color: var(--color-text-muted);">impressions</div>
                </div>
              </div>

              <!-- Forecast chart panel -->
              <div class="sf-panel p-4 mt-3">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-semibold" style="color: var(--color-text-dim);">Forecast · Impressions</span>
                  <span class="sf-chip">P10–P90</span>
                </div>
                <svg viewBox="0 0 320 110" class="w-full h-[110px]" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="sfArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.28" />
                      <stop offset="100%" stop-color="var(--color-accent)" stop-opacity="0" />
                    </linearGradient>
                  </defs>
                  <!-- P10 lower band (secondary, blue) -->
                  <path
                    class="sf-chart-line-sub"
                    d="M0,100 C60,90 90,72 140,76 C190,80 230,58 320,52"
                    fill="none"
                    stroke="var(--color-sf-blue)"
                    stroke-width="1.5"
                    stroke-dasharray="3 3"
                    stroke-linecap="round"
                  />
                  <!-- P50 area + line (primary accent) -->
                  <path
                    class="sf-chart-area"
                    d="M0,88 C60,72 90,44 140,49 C190,54 230,20 320,14 L320,110 L0,110 Z"
                    fill="url(#sfArea)"
                  />
                  <path
                    class="sf-chart-line"
                    d="M0,88 C60,72 90,44 140,49 C190,54 230,20 320,14"
                    fill="none"
                    stroke="var(--color-accent)"
                    stroke-width="2.5"
                    stroke-linecap="round"
                  />
                </svg>
                <div
                  class="mt-1 flex justify-between text-[11px]"
                  style="color: var(--color-text-muted); font-family: var(--font-mono);"
                >
                  <span>P10 · 4.2M</span><span>P50 · 5.1M</span><span>P90 · 5.8M</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ====================== PROBLEM / STATS ======================== -->
      <section class="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div sfScrollReveal class="max-w-2xl">
          <h2
            class="font-semibold text-3xl md:text-4xl"
            style="font-family: var(--font-display); letter-spacing: -0.03em;"
          >
            Brands spend before they <span class="sf-grad-text">know</span>.
          </h2>
          <p class="mt-4" style="color: var(--color-text-dim);">
            Influencer budgets are still committed on gut feel — and the result only shows up weeks
            after the money is gone. Simfluence puts a forecast in front of the spend.
          </p>
        </div>

        <div class="mt-10 grid sm:grid-cols-3 gap-5">
          @for (stat of stats; track stat.label) {
            <div sfScrollReveal class="sf-card p-7" [style.transition-delay.ms]="$index * 100">
              <div
                class="text-4xl md:text-5xl font-semibold"
                style="font-family: var(--font-mono); font-variant-numeric: tabular-nums; color: var(--color-text);"
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
        <div sfScrollReveal class="max-w-2xl mb-12">
          <span class="sf-chip mb-4">The platform</span>
          <h2
            class="font-semibold text-3xl md:text-4xl"
            style="font-family: var(--font-display); letter-spacing: -0.03em;"
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
            <div sfScrollReveal class="sf-card sf-lift p-6" [style.transition-delay.ms]="$index * 80">
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text-dim);"
              >
                <app-icon [name]="f.icon" [size]="19" />
              </div>
              <h3 class="font-semibold text-lg" style="font-family: var(--font-display);">{{ f.title }}</h3>
              <p class="mt-2 text-sm leading-relaxed" style="color: var(--color-text-dim);">{{ f.body }}</p>
              <div class="mt-4 text-xs" style="color: var(--color-text-muted); font-family: var(--font-mono);">
                {{ f.meta }}
              </div>
            </div>
          }
        </div>
      </section>

      <!-- ======================= HOW IT WORKS ========================= -->
      <section id="how" class="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div sfScrollReveal class="max-w-2xl mb-12">
          <span class="sf-chip mb-4">How it works</span>
          <h2
            class="font-semibold text-3xl md:text-4xl"
            style="font-family: var(--font-display); letter-spacing: -0.03em;"
          >
            Brief to forecast in <span class="sf-grad-text">minutes</span>.
          </h2>
        </div>

        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          @for (s of steps; track s.n) {
            <div sfScrollReveal class="sf-panel p-6" [style.transition-delay.ms]="$index * 90">
              <div
                class="text-sm font-semibold w-8 h-8 rounded-lg flex items-center justify-center mb-4"
                style="background: var(--color-bg-3); border: 1px solid var(--color-border); color: var(--color-text); font-family: var(--font-mono);"
              >
                {{ s.n }}
              </div>
              <h3 class="font-semibold" style="font-family: var(--font-display);">{{ s.title }}</h3>
              <p class="mt-2 text-sm" style="color: var(--color-text-dim);">{{ s.body }}</p>
            </div>
          }
        </div>
      </section>

      <!-- ======================== CLOSING CTA ========================= -->
      <section class="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div sfScrollReveal class="sf-card text-center px-6 py-16">
          <div class="max-w-2xl mx-auto">
            <h2
              class="font-semibold text-3xl md:text-4xl"
              style="font-family: var(--font-display); letter-spacing: -0.03em;"
            >
              Your next campaign already has a <span class="sf-grad-text">forecast</span>.
            </h2>
            <p class="mt-4" style="color: var(--color-text-dim);">
              Run your brief. See the range. Launch knowing what to expect.
            </p>
            <a
              routerLink="/login"
              [queryParams]="{ start: 'signup' }"
              class="sf-btn sf-btn-primary !px-7 !py-3 text-base mt-8"
              data-testid="closing-cta"
            >
              Get started
              <app-icon name="arrow-right" [size]="17" />
            </a>
          </div>
        </div>
      </section>

      <!-- ========================== FOOTER ============================ -->
      <footer class="border-t" style="border-color: var(--color-border);">
        <div class="mx-auto max-w-6xl px-5 py-12 grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div class="flex items-center gap-2 mb-3">
              <span class="inline-block w-5 h-5 rounded-md" style="background-image: var(--gradient-brand);"></span>
              <span class="font-semibold" style="font-family: var(--font-display);">Simfluence</span>
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
              <li><a routerLink="/pricing" class="hover:opacity-80">Pricing</a></li>
            </ul>
          </div>

          <div class="text-sm">
            <div class="font-semibold mb-3" style="color: var(--color-text-dim);">Get started</div>
            <ul class="space-y-2" style="color: var(--color-text-muted);">
              <li><a routerLink="/login" class="hover:opacity-80">Log in</a></li>
              <li>
                <a routerLink="/login" [queryParams]="{ start: 'signup' }" class="hover:opacity-80">Create account</a>
              </li>
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
      icon: 'search',
      title: 'Creator discovery',
      body: 'Find creators by what they will deliver, not by follower count. Thousands of creators across YouTube, Twitch and more — searchable by genre, platform and region.',
      meta: 'YouTube · Twitch · multi-platform',
    },
    {
      icon: 'bar-chart',
      title: 'CPI & GFI scoring',
      body: 'Two scores follower count never could. The Simfluence CPI rates cost-per-impression efficiency; the GFI measures genre fit between a creator and your campaign.',
      meta: '0–100 scale · per-creator',
    },
    {
      icon: 'target',
      title: 'Campaign forecasting',
      body: 'Forecast reach and cost with P10 / P50 / P90 confidence bands — so you see the likely range, not a single optimistic number, before you commit budget.',
      meta: 'P10 / P50 / P90 bands',
    },
    {
      icon: 'beaker',
      title: 'What-if simulator',
      body: 'Swap creators in and out, adjust budget, and re-run the forecast instantly to compare scenarios before you settle on a shortlist.',
      meta: 'budget & creator what-ifs',
    },
    {
      icon: 'folder',
      title: 'Campaign workspace',
      body: 'Save briefs, build a shortlist, and keep your forecast alongside the plan — one place for the whole campaign, not a scatter of spreadsheets.',
      meta: 'briefs · shortlists',
    },
    {
      icon: 'mail',
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
}
