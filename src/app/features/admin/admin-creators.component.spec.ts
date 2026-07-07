import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminCreatorsComponent } from './admin-creators.component';
import { AdminCreatorService } from '../../core/admin/admin-creator.service';
import { CreatorsService } from '../../core/creators/creators.service';

function setup(
  addCreators = vi.fn().mockResolvedValue({ created: [{ id: 1, name: 'A', platforms: ['YouTube'] }] }),
) {
  const listCreators = vi.fn().mockResolvedValue({ added: [], offline: [] });
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AdminCreatorsComponent],
    providers: [
      { provide: AdminCreatorService, useValue: { addCreators, listCreators } },
      { provide: CreatorsService, useValue: { submodesByGenre: () => ({ Gaming: [], Music: [] }) } },
    ],
  });
  return { addCreators, listCreators };
}

describe('AdminCreatorsComponent add form', () => {
  it('genre options come from submodesByGenre keys (sorted)', () => {
    setup();
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    expect(fixture.componentInstance.genreOptions()).toEqual(['Gaming', 'Music']);
  });

  it('blocks submit with no platform handle and does not call the service', async () => {
    const { addCreators } = setup();
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    const c = fixture.componentInstance;
    c.form.patchValue({ name: 'A', genre: 'Gaming', youtube: '', twitch: '' });
    await c.onSubmit();
    expect(addCreators).not.toHaveBeenCalled();
    expect(c.error()).toBe('Add at least one platform handle (YouTube or Twitch).');
  });

  it('submits a normalized AddCreatorInput, shows success, refreshes list, resets form', async () => {
    const { addCreators, listCreators } = setup();
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    const c = fixture.componentInstance;
    c.form.patchValue({ name: '  A  ', genre: 'Gaming', youtube: ' @foo ', twitch: '', bio: ' hi ' });
    await c.onSubmit();
    expect(addCreators).toHaveBeenCalledWith([{ name: 'A', genre: 'Gaming', platforms: { youtube: '@foo' }, bio: 'hi' }]);
    expect(c.success()).toContain('Added');
    expect(listCreators.mock.calls.length).toBeGreaterThanOrEqual(2); // constructor load + post-add refresh
    expect(c.form.getRawValue().name).toBe(''); // form reset to blanks, not null
  });

  it('surfaces the service error message', async () => {
    const { addCreators } = setup(vi.fn().mockRejectedValue(new Error('dup')));
    const fixture = TestBed.createComponent(AdminCreatorsComponent);
    const c = fixture.componentInstance;
    c.form.patchValue({ name: 'A', genre: 'Gaming', youtube: 'foo' });
    await c.onSubmit();
    expect(c.error()).toBe('dup');
    expect(addCreators).toHaveBeenCalled();
  });
});
