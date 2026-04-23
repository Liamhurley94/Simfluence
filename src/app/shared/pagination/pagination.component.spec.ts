import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';

import { PaginationComponent } from './pagination.component';

@Component({
  standalone: true,
  imports: [PaginationComponent],
  template: `<app-pagination [page]="page()" [pageCount]="pageCount" (pageChange)="page.set($event)" />`,
})
class HostComponent {
  page = signal(0);
  pageCount = 5;
}

describe('PaginationComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent] });
  });

  it('renders the current page indicator', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const indicator = fixture.nativeElement.querySelector('[data-testid="page-indicator"]');
    expect(indicator.textContent).toContain('Page 1 of 5');
  });

  it('next advances the page', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const next: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="page-next"]');
    next.click();
    expect(fixture.componentInstance.page()).toBe(1);
  });

  it('prev decrements the page', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.page.set(3);
    fixture.detectChanges();
    const prev: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="page-prev"]');
    prev.click();
    expect(fixture.componentInstance.page()).toBe(2);
  });

  it('disables prev on first page, next on last page', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.page.set(0);
    fixture.detectChanges();
    let prev: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="page-prev"]');
    expect(prev.disabled).toBe(true);

    fixture.componentInstance.page.set(4);
    fixture.detectChanges();
    const next: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="page-next"]');
    expect(next.disabled).toBe(true);
  });
});
