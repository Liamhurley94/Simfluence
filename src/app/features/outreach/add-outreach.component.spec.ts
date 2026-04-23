import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';

import { AddOutreachComponent } from './add-outreach.component';
import {
  CampaignsRepository,
  InMemoryCampaignsRepository,
} from '../../core/campaigns/campaigns.repository';
import { NewOutreachRecord } from '../../core/outreach/outreach.types';

@Component({
  standalone: true,
  imports: [AddOutreachComponent],
  template: `
    <app-add-outreach
      (save)="saved.set($event)"
      (cancel)="cancelled.set(cancelled() + 1)"
    />
  `,
})
class HostComponent {
  saved = signal<NewOutreachRecord | null>(null);
  cancelled = signal(0);
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('AddOutreachComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: CampaignsRepository, useClass: InMemoryCampaignsRepository },
      ],
    });
  });

  it('save is disabled until a creator is selected', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    const save: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="outreach-add-save"]',
    );
    expect(save.disabled).toBe(true);
  });

  it('search shows match suggestions after 2+ chars', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="outreach-add-search"]',
    );
    input.value = 'quin';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const matches = fixture.nativeElement.querySelector('[data-testid="outreach-add-matches"]');
    expect(matches).toBeTruthy();
  });

  it('picking a match swaps the search for the selected-creator chip', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="outreach-add-search"]',
    );
    input.value = 'quin';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const firstMatch: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid^="outreach-add-match-"]',
    );
    firstMatch.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="outreach-add-selected"]')).toBeTruthy();
    const save: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="outreach-add-save"]',
    );
    expect(save.disabled).toBe(false);
  });

  it('emits save with creatorId, status, and trimmed contact', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="outreach-add-search"]',
    );
    input.value = 'quin';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const firstMatch: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid^="outreach-add-match-"]',
    );
    firstMatch.click();
    fixture.detectChanges();

    const contact: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="outreach-add-contact"]',
    );
    contact.value = '  hi@example.com  ';
    contact.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const save: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="outreach-add-save"]',
    );
    save.click();

    const dto = fixture.componentInstance.saved();
    expect(dto).toBeTruthy();
    expect(typeof dto!.creatorId).toBe('number');
    expect(dto!.contact).toBe('hi@example.com');
    expect(dto!.status).toBe('shortlisted');
  });

  it('cancel button emits cancel', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const cancel: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="outreach-add-cancel"]',
    );
    cancel.click();
    expect(fixture.componentInstance.cancelled()).toBe(1);
  });
});
