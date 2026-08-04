import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDiscoveryComponent } from './admin-discovery.component';
import { AdminDiscoveryService } from '../../core/admin/admin-discovery.service';
import { AdminCreatorService } from '../../core/admin/admin-creator.service';
import { CreatorsService } from '../../core/creators/creators.service';
import { QuotaStatus } from '../../core/admin/admin-discovery.types';

function setup(quota: QuotaStatus | null = null, overrides: { activeRunStatuses?: ReturnType<typeof vi.fn> } = {}) {
  const quotaStatus = vi.fn().mockResolvedValue(quota);
  const listQueue = vi.fn().mockResolvedValue({ rows: [], total: 0 });
  const activeRunStatuses = overrides.activeRunStatuses ?? vi.fn().mockResolvedValue([]);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AdminDiscoveryComponent],
    providers: [
      { provide: AdminDiscoveryService, useValue: { quotaStatus, listQueue, activeRunStatuses } },
      { provide: AdminCreatorService, useValue: { listCreators: vi.fn().mockResolvedValue({ added: [], offline: [] }), addCreators: vi.fn() } },
      { provide: CreatorsService, useValue: { submodesByGenre: () => ({ Gaming: [] }), languages: () => [] } },
    ],
  });
  return { quotaStatus, listQueue, activeRunStatuses };
}

/** Create the fixture and let the constructor's initial refreshBadges() (a
 *  Promise.all of mocked calls) settle. Two stabilize rounds: the first
 *  Promise.all resolution and the second's DOM-affecting `.set()` calls land
 *  in separate microtask ticks relative to a single whenStable(). */
async function create() {
  const fixture = TestBed.createComponent(AdminDiscoveryComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('AdminDiscoveryComponent — pill nav', () => {
  it('refreshes badges on every pill switch, not just on child (staged)/(changed) events', async () => {
    const { quotaStatus } = setup();
    const fixture = await create();
    quotaStatus.mockClear();

    const queueBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="discovery-view-queue"]');
    queueBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(quotaStatus).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.view()).toBe('queue');
  });

  it('adds a fifth Taxonomy pill without switching to it (avoids instantiating app-taxonomy here)', async () => {
    setup();
    const fixture = await create();
    const tab: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="discovery-view-taxonomy"]');
    expect(tab).not.toBeNull();
    expect(tab.textContent?.trim()).toBe('Taxonomy');
    expect(fixture.componentInstance.view()).toBe('search'); // unchanged — never clicked
  });

  it('marks the pill nav as a tablist with per-pill tab semantics', async () => {
    setup();
    const fixture = await create();
    const nav: HTMLElement = fixture.nativeElement.querySelector('[role="tablist"]');
    expect(nav).not.toBeNull();

    const searchTab: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="discovery-view-search"]');
    expect(searchTab.getAttribute('role')).toBe('tab');
    expect(searchTab.getAttribute('aria-selected')).toBe('true');

    const queueTab: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="discovery-view-queue"]');
    expect(queueTab.getAttribute('aria-selected')).toBe('false');
  });
});

describe('AdminDiscoveryComponent — sweeps badge', () => {
  it('sweepBadge reflects in-flight runs: running wins over paused, empty hides', async () => {
    const activeRunStatuses = vi.fn().mockResolvedValue(['queued', 'paused_quota']);
    setup(null, { activeRunStatuses });
    const fixture = await create();
    const component = fixture.componentInstance;

    await component.refreshBadges();
    expect(component.sweepBadge()).toBe('running');

    activeRunStatuses.mockResolvedValue(['paused_quota']);
    await component.refreshBadges();
    expect(component.sweepBadge()).toBe('paused');

    activeRunStatuses.mockResolvedValue([]);
    await component.refreshBadges();
    expect(component.sweepBadge()).toBeNull();
  });
});

describe('AdminDiscoveryComponent — quota chip', () => {
  it('clamps the remaining count at zero when used_today exceeds the ceiling', async () => {
    setup({
      effective_ceiling: 9500, elevated_limit: 950000, default_limit: 9500,
      elevated_until: '2027-01-08T08:00:00Z', used_today: 9600,
    });
    const fixture = await create();

    expect(fixture.componentInstance.quotaRemaining()).toBe(0);
    const chip: HTMLElement = fixture.nativeElement.querySelector('[data-testid="discovery-quota-chip"]');
    expect(chip.textContent).toContain('0');
    expect(chip.textContent).not.toContain('-100');
  });
});
