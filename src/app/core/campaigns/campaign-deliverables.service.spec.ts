import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignDeliverablesService } from './campaign-deliverables.service';
import { CampaignDeliverablesRepository } from './campaign-deliverables.repository';
import { CampaignDeliverable } from './campaign-deliverables.types';

function deliverable(over: Partial<CampaignDeliverable> = {}): CampaignDeliverable {
  return {
    id: 'd1', campaignCreatorId: 'cc1', platform: 'YouTube', format: 'Integrated',
    quantity: 1, durationHours: null, agreedFee: null,
    actualImpressions: null, actualClicks: null, actualConversions: null,
    actualSpend: null, actualRevenue: null, deliveredAt: null,
    createdAt: '2026-08-26T00:00:00Z', updatedAt: '2026-08-26T00:00:00Z',
    ...over,
  };
}

describe('CampaignDeliverablesService', () => {
  let repo: ReturnType<typeof createMockRepo>;
  let svc: CampaignDeliverablesService;

  function createMockRepo() {
    return {
      listForCampaignCreators: vi.fn().mockResolvedValue([]),
      add: vi.fn(),
      update: vi.fn(),
      updateActuals: vi.fn(),
      remove: vi.fn().mockResolvedValue(undefined),
    };
  }

  beforeEach(() => {
    repo = createMockRepo();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: CampaignDeliverablesRepository, useValue: repo as unknown as CampaignDeliverablesRepository }],
    });
    svc = TestBed.inject(CampaignDeliverablesService);
  });

  it('loadFor populates records and groups by campaign creator', async () => {
    repo.listForCampaignCreators.mockResolvedValue([
      deliverable({ id: 'd1', campaignCreatorId: 'cc1' }),
      deliverable({ id: 'd2', campaignCreatorId: 'cc1', format: 'Dedicated' }),
      deliverable({ id: 'd3', campaignCreatorId: 'cc2', platform: 'Twitch', format: 'Dedicated', durationHours: 2 }),
    ]);
    await svc.loadFor(['cc1', 'cc2']);
    expect(svc.records().length).toBe(3);
    expect(svc.byCampaignCreator().get('cc1')!.length).toBe(2);
    expect(svc.byCampaignCreator().get('cc2')!.length).toBe(1);
  });

  it('add appends the created row', async () => {
    repo.add.mockResolvedValue(deliverable({ id: 'dNew' }));
    const created = await svc.add({ campaignCreatorId: 'cc1', platform: 'YouTube', format: 'Integrated' });
    expect(created!.id).toBe('dNew');
    expect(svc.records().map((d: CampaignDeliverable) => d.id)).toContain('dNew');
  });

  it('add surfaces repo errors and returns null', async () => {
    repo.add.mockRejectedValue(new Error('violates check constraint'));
    const created = await svc.add({ campaignCreatorId: 'cc1', platform: 'YouTube', format: 'Integrated' });
    expect(created).toBeNull();
    expect(svc.error()).toContain('check constraint');
  });

  it('update replaces the row in place', async () => {
    repo.listForCampaignCreators.mockResolvedValue([deliverable({ id: 'd1', quantity: 1 })]);
    await svc.loadFor(['cc1']);
    repo.update.mockResolvedValue(deliverable({ id: 'd1', quantity: 3 }));
    await svc.update('d1', { quantity: 3 });
    expect(svc.records()[0].quantity).toBe(3);
  });

  it('updateActuals patches the row and replaces it in records', async () => {
    repo.listForCampaignCreators.mockResolvedValue([deliverable({ id: 'd1' })]);
    await svc.loadFor(['cc1']);
    repo.updateActuals.mockResolvedValue({ ...deliverable({ id: 'd1' }), actualImpressions: 12000, deliveredAt: '2026-08-01' });
    const res = await svc.updateActuals('d1', { actualImpressions: 12000, deliveredAt: '2026-08-01' });
    expect(repo.updateActuals).toHaveBeenCalledWith('d1', { actualImpressions: 12000, deliveredAt: '2026-08-01' });
    expect(res?.actualImpressions).toBe(12000);
    expect((svc.records()[0] as CampaignDeliverable & { deliveredAt: string | null }).deliveredAt).toBe('2026-08-01');
  });

  it('remove is optimistic and rolls back on error', async () => {
    repo.listForCampaignCreators.mockResolvedValue([deliverable({ id: 'd1' })]);
    await svc.loadFor(['cc1']);
    repo.remove.mockRejectedValue(new Error('nope'));
    await svc.remove('d1');
    expect(svc.records().map((d: CampaignDeliverable) => d.id)).toContain('d1'); // rolled back
    expect(svc.error()).toBe('nope');
  });
});
