import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { DeliverableEditorComponent } from './deliverable-editor.component';
import { CampaignDeliverablesService } from '../../../core/campaigns/campaign-deliverables.service';
import { CampaignDeliverablesRepository } from '../../../core/campaigns/campaign-deliverables.repository';
import { AuthService } from '../../../core/auth/auth.service';
import { CampaignDeliverable } from '../../../core/campaigns/campaign-deliverables.types';
import { CampaignCreator } from '../../../core/campaigns/campaign-creators.types';
import { Creator } from '../../../core/data/creator.types';

function cc(over: Partial<CampaignCreator> = {}): CampaignCreator {
  return {
    id: 'cc1', campaignId: 'camp1', creatorId: 42, status: 'shortlisted', source: 'manual',
    format: null, contactEmail: null, contactHandle: null, notes: null, lastContactAt: null,
    rateEstimate: null, cpiAtAdd: null, actualImpressions: null, actualClicks: null,
    actualConversions: null, actualSpend: null, actualRevenue: null, debriefNotes: null,
    addedAt: '', updatedAt: '', ...over,
  };
}
function creator(over: Partial<Creator> = {}): Creator {
  return { id: 42, name: 'Test', handle: 'test', platform: 'YouTube', ...over } as Creator;
}
function d(over: Partial<CampaignDeliverable> = {}): CampaignDeliverable {
  return {
    id: 'd1', campaignCreatorId: 'cc1', platform: 'YouTube', format: 'Integrated',
    quantity: 1, durationHours: null, agreedFee: null, createdAt: '', updatedAt: '', ...over,
  };
}

describe('DeliverableEditorComponent', () => {
  let fixture: ComponentFixture<DeliverableEditorComponent>;
  let svc: CampaignDeliverablesService;

  async function mount(creatorRow: Creator | null, rows: CampaignDeliverable[]) {
    const repo = {
      listForCampaignCreators: vi.fn().mockResolvedValue(rows),
      add: vi.fn(),
      update: vi.fn().mockImplementation(async (id: string, dto: Partial<CampaignDeliverable>) =>
        ({ ...rows.find((r) => r.id === id), ...dto }) as CampaignDeliverable),
      remove: vi.fn(),
    };
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [DeliverableEditorComponent],
      providers: [
        { provide: CampaignDeliverablesRepository, useValue: repo as unknown as CampaignDeliverablesRepository },
        { provide: AuthService, useValue: { isAdmin: () => false } },
      ],
    }).compileComponents();
    svc = TestBed.inject(CampaignDeliverablesService);
    await svc.loadFor(['cc1']);
    fixture = TestBed.createComponent(DeliverableEditorComponent);
    fixture.componentRef.setInput('campaignCreator', cc());
    fixture.componentRef.setInput('creator', creatorRow);
    fixture.componentRef.setInput('disabled', false);
    fixture.detectChanges();
  }

  it('renders a YouTube row with a format select and no hours input', async () => {
    await mount(creator(), [d()]);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="deliverable-format-d1"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="deliverable-hours-d1"]')).toBeNull();
  });

  it('renders a Twitch row with fixed "Dedicated stream" and an hours input', async () => {
    await mount(creator({ platform: 'Twitch' }),
      [d({ platform: 'Twitch', format: 'Dedicated', durationHours: 2 })]);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="deliverable-format-d1"]')).toBeNull();
    expect(el.textContent).toContain('Dedicated stream');
    expect(el.querySelector('[data-testid="deliverable-hours-d1"]')).toBeTruthy();
  });

  it('offers only attached platforms; unattached forecastable ones are disabled options', async () => {
    await mount(creator({ platform: 'Twitch', allPlatforms: ['Twitch'] }),
      [d({ platform: 'Twitch', format: 'Dedicated' })]);
    const sel = fixture.nativeElement.querySelector('[data-testid="deliverable-platform-d1"]') as HTMLSelectElement;
    const opts = Array.from(sel.options);
    const yt = opts.find((o) => o.value === 'YouTube')!;
    expect(yt.disabled).toBe(true);
    expect(yt.textContent).toContain('not attached');
  });

  it('shows the empty state when no forecastable platform is attached', async () => {
    await mount(creator({ platform: 'Instagram', allPlatforms: ['Instagram'] }), []);
    expect(fixture.nativeElement.querySelector('[data-testid="deliverables-none"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="deliverable-add"]')).toBeNull();
  });

  it('displays the row\'s stored platform when the creator has both platforms attached (not the first option)', async () => {
    await mount(creator({ platform: 'Twitch', allPlatforms: ['Twitch', 'YouTube'] }),
      [d({ platform: 'Twitch', format: 'Dedicated', durationHours: 2 })]);
    const sel = fixture.nativeElement.querySelector('[data-testid="deliverable-platform-d1"]') as HTMLSelectElement;
    expect(sel.value).toBe('Twitch');
  });

  it('displays the row\'s stored format (not the first option)', async () => {
    await mount(creator(), [d({ format: 'Dedicated' })]);
    const sel = fixture.nativeElement.querySelector('[data-testid="deliverable-format-d1"]') as HTMLSelectElement;
    expect(sel.value).toBe('Dedicated');
  });

  it('disables all controls when the disabled input is set', async () => {
    await mount(creator(), [d()]);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const qty = fixture.nativeElement.querySelector('[data-testid="deliverable-qty-d1"]') as HTMLInputElement;
    expect(qty.disabled).toBe(true);
  });

  it('changing platform from YouTube to Twitch resets format/duration to the Dedicated defaults', async () => {
    await mount(creator({ platform: 'YouTube', allPlatforms: ['YouTube', 'Twitch'] }), [d()]);
    const updateSpy = vi.spyOn(svc, 'update');
    const sel = fixture.nativeElement.querySelector('[data-testid="deliverable-platform-d1"]') as HTMLSelectElement;
    sel.value = 'Twitch';
    sel.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(updateSpy).toHaveBeenCalledWith('d1', { platform: 'Twitch', format: 'Dedicated', durationHours: 2 });
  });

  it('changing platform from Twitch to YouTube resets format/duration to the Integrated defaults', async () => {
    await mount(creator({ platform: 'Twitch', allPlatforms: ['Twitch', 'YouTube'] }),
      [d({ platform: 'Twitch', format: 'Dedicated', durationHours: 2 })]);
    const updateSpy = vi.spyOn(svc, 'update');
    const sel = fixture.nativeElement.querySelector('[data-testid="deliverable-platform-d1"]') as HTMLSelectElement;
    sel.value = 'YouTube';
    sel.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(updateSpy).toHaveBeenCalledWith('d1', { platform: 'YouTube', format: 'Integrated', durationHours: null });
  });

  it('onHoursBlur clamps 0 up to the 0.5 minimum (DB CHECK duration_hours > 0)', async () => {
    await mount(creator({ platform: 'Twitch' }),
      [d({ platform: 'Twitch', format: 'Dedicated', durationHours: 2 })]);
    const updateSpy = vi.spyOn(svc, 'update');
    const input = fixture.nativeElement.querySelector('[data-testid="deliverable-hours-d1"]') as HTMLInputElement;
    input.value = '0';
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(updateSpy).toHaveBeenCalledWith('d1', { durationHours: 0.5 });
  });

  it('onFeeBlur maps an empty string to null', async () => {
    await mount(creator(), [d({ agreedFee: 500 })]);
    const updateSpy = vi.spyOn(svc, 'update');
    const input = fixture.nativeElement.querySelector('[data-testid="deliverable-fee-d1"]') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(updateSpy).toHaveBeenCalledWith('d1', { agreedFee: null });
  });

  it('onFeeBlur clamps a negative fee to 0 (DB CHECK agreed_fee >= 0)', async () => {
    await mount(creator(), [d()]);
    const updateSpy = vi.spyOn(svc, 'update');
    const input = fixture.nativeElement.querySelector('[data-testid="deliverable-fee-d1"]') as HTMLInputElement;
    input.value = '-50';
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(updateSpy).toHaveBeenCalledWith('d1', { agreedFee: 0 });
  });
});
