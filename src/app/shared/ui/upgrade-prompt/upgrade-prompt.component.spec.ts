import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { UpgradePromptComponent } from './upgrade-prompt.component';
import { UpgradePromptService } from '../../../core/upgrade/upgrade-prompt.service';

describe('UpgradePromptComponent', () => {
  let service: UpgradePromptService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [UpgradePromptComponent] });
    service = TestBed.inject(UpgradePromptService);
  });

  it('renders nothing when service has no current request', () => {
    const fixture = TestBed.createComponent(UpgradePromptComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="upgrade-dialog"]')).toBeNull();
  });

  it('renders the dialog when service has a request', () => {
    service.open('Personas', 'silver');
    const fixture = TestBed.createComponent(UpgradePromptComponent);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[data-testid="upgrade-dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('Personas');
    expect(dialog.textContent).toContain('Silver');
  });

  it('close button clears the request', () => {
    service.open('Campaigns', 'silver');
    const fixture = TestBed.createComponent(UpgradePromptComponent);
    fixture.detectChanges();
    const closeBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="upgrade-close"]',
    );
    closeBtn.click();
    fixture.detectChanges();
    expect(service.current()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="upgrade-dialog"]')).toBeNull();
  });

  it('backdrop click clears the request; dialog click does not', () => {
    service.open('Outreach', 'silver');
    const fixture = TestBed.createComponent(UpgradePromptComponent);
    fixture.detectChanges();

    const dialog: HTMLElement = fixture.nativeElement.querySelector('[data-testid="upgrade-dialog"]');
    dialog.click();
    fixture.detectChanges();
    expect(service.current()).not.toBeNull();

    const backdrop: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="upgrade-backdrop"]',
    );
    backdrop.click();
    fixture.detectChanges();
    expect(service.current()).toBeNull();
  });
});
