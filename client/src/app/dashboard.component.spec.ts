import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardComponent } from './pages/dashboard.component';

describe('DashboardComponent', () => {
  beforeEach(() => { TestBed.configureTestingModule({ imports: [DashboardComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }); });
  it('creates the hospital overview', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('links the billing actions to the matching invoice filters', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const cards = Array.from(fixture.nativeElement.querySelectorAll('.metric-grid .metric-card')).slice(2) as HTMLElement[];
    const links = cards.map(card => card.querySelector<HTMLAnchorElement>('.metric-bottom a'));
    expect(links.every(Boolean)).toBeTrue();
    expect(links.map(link => link?.textContent?.trim())).toEqual(['View billing ↗', 'Review ↗']);
    expect(links.map(link => link?.getAttribute('href'))).toEqual(['/billing?status=paid', '/billing?status=pending']);
  });
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
                         