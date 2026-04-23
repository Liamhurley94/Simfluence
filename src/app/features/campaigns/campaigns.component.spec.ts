import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignsComponent } from './campaigns.component';
import { AuthService } from '../../core/auth/auth.service';
import { CampaignsService } from '../../core/campaigns/campaigns.service';
import {
  CampaignsRepository,
  InMemoryCampaignsRepository,
} from '../../core/campaigns/campaigns.repository';
import { BriefPdfService } from '../../core/campaigns/brief-pdf.service';

function setup({ tier = 'silver' } = {}) {
  const tierSignal = signal(tier);
  const authStub = { tier: tierSignal, user: () => null, isAuthenticated: () => true };
  const queryParamMap$ = new BehaviorSubject(convertToParamMap({}));

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CampaignsComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authStub },
      { provide: CampaignsRepository, useClass: InMemoryCampaignsRepository },
      { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMap$ } },
    ],
  });

  return {
    svc: TestBed.inject(CampaignsService),
    pdf: TestBed.inject(BriefPdfService),
    tier: tierSignal,
  };
}

async function flush() {
  // Allow the async load() triggered in the constructor to settle.
  await Promise.resolve();
  await Promise.resolve();
}

describe('CampaignsComponent', () => {
  beforeEach(() => {
    /* noop */
  });

  it('shows empty state when no campaigns exist', async () => {
    setup();
    const fixture = TestBed.createComponent(CampaignsComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="campaigns-empty"]')).toBeTruthy();
  });

  it('renders a grid of campaigns after they exist', async () => {
    const { svc } = setup();
    await svc.create({
      name: 'Alpha',
      client: 'A',
      genre: 'Gaming',
      budget: 1,
      goLiveDate: null,
      notes: '',
      creatorIds: [],
      forecast: null,
    });
    const fixture = TestBed.createComponent(CampaignsComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="campaigns-grid"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Alpha');
  });

  it('opens the form modal when "New campaign" is clicked', async () => {
    setup();
    const fixture = TestBed.createComponent(CampaignsComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="campaigns-new"]');
    btn.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="campaign-form"]')).toBeTruthy();
  });

  it('delete button removes the campaign from the grid', async () => {
    const { svc } = setup();
    const created = await svc.create({
      name: 'ToDelete',
      client: '',
      genre: '',
      budget: 1,
      goLiveDate: null,
      notes: '',
      creatorIds: [],
      forecast: null,
    });
    const fixture = TestBed.createComponent(CampaignsComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const delBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      `[data-testid="campaign-delete-${created!.id}"]`,
    );
    delBtn.click();
    await flush();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="campaigns-empty"]')).toBeTruthy();
  });

  it('brief PDF button is disabled for non-platinum tiers', async () => {
    const { svc, tier } = setup();
    tier.set('gold');
    const created = await svc.create({
      name: 'Alpha',
      client: '',
      genre: '',
      budget: 1,
      goLiveDate: null,
      notes: '',
      creatorIds: [],
      forecast: null,
    });
    const fixture = TestBed.createComponent(CampaignsComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector(
      `[data-testid="campaign-pdf-${created!.id}"]`,
    );
    expect(btn.disabled).toBe(true);
  });

  it('brief PDF button calls export() for platinum+ tiers', async () => {
    const { svc, pdf, tier } = setup();
    tier.set('platinum');
    const exportSpy = vi.spyOn(pdf, 'export').mockReturnValue(true);

    const created = await svc.create({
      name: 'Alpha',
      client: '',
      genre: '',
      budget: 1,
      goLiveDate: null,
      notes: '',
      creatorIds: [],
      forecast: null,
    });
    const fixture = TestBed.createComponent(CampaignsComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector(
      `[data-testid="campaign-pdf-${created!.id}"]`,
    );
    btn.click();
    expect(exportSpy).toHaveBeenCalledOnce();
    expect(exportSpy.mock.calls[0][0].id).toBe(created!.id);
  });
});
