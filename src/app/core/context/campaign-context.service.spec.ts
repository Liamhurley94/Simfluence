import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { CampaignContextService } from './campaign-context.service';

describe('CampaignContextService.setGenre', () => {
  function setup() {
    TestBed.configureTestingModule({});
    const svc = TestBed.inject(CampaignContextService);
    return svc;
  }

  it('clears subMode when the genre changes', () => {
    const svc = setup();
    svc.genre.set('Gaming & Esports');
    svc.subMode.set('Battle Royale');

    svc.setGenre('Beauty & Lifestyle');

    expect(svc.genre()).toBe('Beauty & Lifestyle');
    expect(svc.subMode()).toBe('');
  });

  it('leaves subMode untouched when setGenre is called with the same genre', () => {
    const svc = setup();
    svc.genre.set('Gaming & Esports');
    svc.subMode.set('Battle Royale');

    svc.setGenre('Gaming & Esports');

    expect(svc.genre()).toBe('Gaming & Esports');
    expect(svc.subMode()).toBe('Battle Royale');
  });
});
