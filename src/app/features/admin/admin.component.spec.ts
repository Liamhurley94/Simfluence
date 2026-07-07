import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { AdminComponent } from './admin.component';
import { EnterpriseService } from '../../core/enterprise/enterprise.service';
import { AdminCreatorService } from '../../core/admin/admin-creator.service';
import { CreatorsService } from '../../core/creators/creators.service';

describe('AdminComponent tabs', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [
        provideRouter([]),
        { provide: EnterpriseService, useValue: { adminListEnterprises: vi.fn().mockResolvedValue({ enterprises: [] }) } },
        { provide: AdminCreatorService, useValue: { listCreators: vi.fn().mockResolvedValue({ added: [], offline: [] }), addCreators: vi.fn() } },
        { provide: CreatorsService, useValue: { submodesByGenre: () => ({ Gaming: [] }) } },
      ],
    });
  });

  it('defaults to the Enterprises tab', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.tab()).toBe('enterprises');
    expect(fixture.nativeElement.querySelector('[data-testid="admin-creators"]')).toBeNull();
  });

  it('switches to the Creators tab and renders the creators panel', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="admin-tab-creators"]');
    btn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.tab()).toBe('creators');
    expect(fixture.nativeElement.querySelector('[data-testid="admin-creators"]')).not.toBeNull();
  });
});
