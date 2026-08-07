import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { BrowseCreatorsModalComponent } from './browse-creators-modal.component';
import { CreatorsService } from '../../../core/creators/creators.service';
import { CreatorProfileService } from '../../../core/creator-profile/creator-profile.service';
import { Creator, PagedCreators } from '../../../core/data/creator.types';

function mkCreator(id: number, overrides: Partial<Creator> = {}): Creator {
  return {
    id,
    name: `Creator ${id}`,
    handle: `c${id}`,
    platform: 'YouTube',
    allPlatforms: ['YouTube'],
    subs: '500K',
    subsParsed: 500_000,
    avgViews: '50K',
    eng: '4%',
    genre: 'Gaming & Esports',
    cpi: 80,
    gfi: 70,
    color: '#fff',
    verifiedDeals: 0,
    sponsorHistory: [],
    bio: '',
    ...overrides,
  };
}

function page(creators: Creator[]): PagedCreators {
  return { creators, total: creators.length, pageCount: 1, page: 0 };
}

function setup(creators: Creator[] = [mkCreator(4), mkCreator(5)]) {
  const list = vi.fn().mockResolvedValue(page(creators));
  const creatorsStub = { list } as unknown as CreatorsService;
  const open = vi.fn();
  const profileStub = { open } as unknown as CreatorProfileService;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BrowseCreatorsModalComponent],
    providers: [
      { provide: CreatorsService, useValue: creatorsStub },
      { provide: CreatorProfileService, useValue: profileStub },
    ],
  });

  const fixture = TestBed.createComponent(BrowseCreatorsModalComponent);
  fixture.detectChanges();
  return { fixture, open, list };
}

async function settle(fixture: { whenStable: () => Promise<unknown>; detectChanges: () => void }) {
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('BrowseCreatorsModalComponent — profile modal', () => {
  it('opens the profile with the full Creator when a row is clicked', async () => {
    const creator = mkCreator(4);
    const { fixture, open } = setup([creator, mkCreator(5)]);
    await settle(fixture);

    fixture.nativeElement.querySelector('[data-testid="browse-creator-4"]').click();

    // open(), not openById() — rows here already hold a hydrated Creator, so
    // the header paints instantly instead of showing the skeleton.
    expect(open).toHaveBeenCalledOnce();
    expect(open.mock.calls[0][0].id).toBe(4);
  });

  it('does NOT open the profile when the Add button is clicked', async () => {
    const { fixture, open } = setup();
    await settle(fixture);

    const emitted: number[] = [];
    fixture.componentInstance.add.subscribe((v: number) => emitted.push(v));

    fixture.nativeElement.querySelector('[data-testid="browse-creator-add-4"]').click();

    expect(emitted).toEqual([4]); // add still fires
    expect(open).not.toHaveBeenCalled(); // but the click stops there
  });
});
