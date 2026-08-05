import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AdminAddFormComponent } from './admin-add-form.component';
import { AdminCreatorService } from '../../core/admin/admin-creator.service';
import { CreatorsService } from '../../core/creators/creators.service';

function setup(
  addCreators = vi.fn().mockResolvedValue({ created: [{ id: 1, name: 'A', platforms: ['YouTube'] }] }),
) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AdminAddFormComponent],
    providers: [
      { provide: AdminCreatorService, useValue: { addCreators } },
      { provide: CreatorsService, useValue: { submodesByGenre: () => ({ Gaming: [], Music: [] }), languages: () => [{ code: 'de', name: 'German' }, { code: 'en', name: 'English' }] } },
    ],
  });
  return { addCreators };
}

describe('AdminAddFormComponent', () => {
  it('genre options come from submodesByGenre keys (sorted)', () => {
    setup();
    const fixture = TestBed.createComponent(AdminAddFormComponent);
    expect(fixture.componentInstance.genreOptions()).toEqual(['Gaming', 'Music']);
  });

  it('language options come from CreatorsService.languages (sorted by name)', () => {
    setup();
    const fixture = TestBed.createComponent(AdminAddFormComponent);
    expect(fixture.componentInstance.languageOptions()).toEqual([{ code: 'en', name: 'English' }, { code: 'de', name: 'German' }]);
  });

  it('blocks submit with no platform handle and does not call the service', async () => {
    const { addCreators } = setup();
    const fixture = TestBed.createComponent(AdminAddFormComponent);
    const c = fixture.componentInstance;
    c.form.patchValue({ name: 'A', genre: 'Gaming', youtube: '', twitch: '' });
    await c.onSubmit();
    expect(addCreators).not.toHaveBeenCalled();
    expect(c.error()).toBe('Add at least one platform handle (YouTube or Twitch).');
  });

  it('submits a normalized AddCreatorInput, shows success, resets form', async () => {
    const { addCreators } = setup();
    const fixture = TestBed.createComponent(AdminAddFormComponent);
    const c = fixture.componentInstance;
    c.form.patchValue({ name: '  A  ', genre: 'Gaming', youtube: ' @foo ', twitch: '', bio: ' hi ' });
    await c.onSubmit();
    expect(addCreators).toHaveBeenCalledWith([{ name: 'A', genre: 'Gaming', platforms: { youtube: '@foo' }, bio: 'hi' }]);
    expect(c.success()).toContain('Added');
    expect(c.form.getRawValue().name).toBe(''); // form reset to blanks, not null
  });

  it('emits added after a successful submit', async () => {
    const { addCreators } = setup();
    const fixture = TestBed.createComponent(AdminAddFormComponent);
    const c = fixture.componentInstance;
    let emitted = false;
    c.added.subscribe(() => (emitted = true));
    c.form.patchValue({ name: 'A', genre: 'Gaming', youtube: 'foo', twitch: '' });
    await c.onSubmit();
    expect(addCreators).toHaveBeenCalled();
    expect(emitted).toBe(true);
  });

  it('surfaces the service error message', async () => {
    const { addCreators } = setup(vi.fn().mockRejectedValue(new Error('dup')));
    const fixture = TestBed.createComponent(AdminAddFormComponent);
    const c = fixture.componentInstance;
    c.form.patchValue({ name: 'A', genre: 'Gaming', youtube: 'foo' });
    await c.onSubmit();
    expect(c.error()).toBe('dup');
    expect(addCreators).toHaveBeenCalled();
  });

  it('warns when a background kick failed', async () => {
    const { addCreators } = setup();
    addCreators.mockResolvedValue({
      created: [{ id: 1, name: 'X', platforms: ['YouTube'] }],
      kicks: { youtube: 'failed', gfi: 'ok', twitch: 'skipped' },
    });
    const fixture = TestBed.createComponent(AdminAddFormComponent);
    const c = fixture.componentInstance;
    c.form.patchValue({ name: '  A  ', genre: 'Gaming', youtube: ' @foo ', twitch: '', bio: ' hi ' });
    await c.onSubmit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="add-warning"]')?.textContent).toContain('youtube');
  });
});
