import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';

import { CampaignFormComponent } from './campaign-form.component';
import { Campaign, NewCampaign } from '../../core/campaigns/campaign.types';

@Component({
  standalone: true,
  imports: [CampaignFormComponent],
  template: `
    <app-campaign-form
      [editing]="editing()"
      [defaults]="defaults()"
      (save)="lastSaved.set($event)"
      (cancel)="cancelCount.set(cancelCount() + 1)"
    />
  `,
})
class HostComponent {
  editing = signal<Campaign | null>(null);
  defaults = signal<Partial<NewCampaign> | null>(null);
  lastSaved = signal<NewCampaign | null>(null);
  cancelCount = signal(0);
}

describe('CampaignFormComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent] });
  });

  it('header reads "New campaign" when no row is being edited', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('h2');
    expect(heading.textContent).toContain('New campaign');
  });

  it('seeds the form when `defaults` is provided', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.defaults.set({
      name: 'Seeded',
      genre: 'Music',
      budget: 12345,
    });
    fixture.detectChanges();
    const name: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="campaign-name"]');
    expect(name.value).toBe('Seeded');
    const budget: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="campaign-budget"]');
    expect(budget.value).toBe('12345');
  });

  it('does not emit save when the form is invalid', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const save: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="campaign-form-save"]');
    save.click();
    expect(fixture.componentInstance.lastSaved()).toBeNull();
  });

  it('emits save with trimmed values when the form is valid', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const name: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="campaign-name"]');
    const budget: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="campaign-budget"]');

    name.value = '  Alpha  ';
    name.dispatchEvent(new Event('input'));
    budget.value = '25000';
    budget.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const save: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="campaign-form-save"]');
    save.click();

    const dto = fixture.componentInstance.lastSaved();
    expect(dto?.name).toBe('Alpha');
    expect(dto?.budget).toBe(25000);
    expect(dto?.goLiveDate).toBeNull();
  });

  it('cancel button emits cancel', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const cancel: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="campaign-form-cancel"]');
    cancel.click();
    expect(fixture.componentInstance.cancelCount()).toBe(1);
  });

  it('uses "Edit campaign" header when editing', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.editing.set({
      id: 'x',
      name: 'Existing',
      client: 'Client',
      genre: 'G',
      budget: 100,
      goLiveDate: null,
      notes: '',
      creatorIds: [],
      forecast: null,
      createdAt: '',
      updatedAt: '',
    });
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('h2');
    expect(heading.textContent).toContain('Edit campaign');
    const name: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="campaign-name"]');
    expect(name.value).toBe('Existing');
  });
});
