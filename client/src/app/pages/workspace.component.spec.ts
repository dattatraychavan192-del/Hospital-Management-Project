import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { WorkspaceComponent } from './workspace.component';

describe('WorkspaceComponent billing', () => {
  let http: HttpTestingController;

  function createBillingWorkspace(query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [WorkspaceComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { kind: 'billing' }, queryParamMap: convertToParamMap(query) },
            queryParamMap: of(convertToParamMap(query))
          }
        },
        { provide: AuthService, useValue: { user: signal({ role: 'admin' }) } }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(WorkspaceComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('loads unpaid and partially paid invoices from the pending dashboard filter', () => {
    const fixture = createBillingWorkspace({ status: 'pending' });
    const request = http.expectOne('/api/invoices?status=pending');
    request.flush({
      items: [
        { _id: 'unpaid-id', invoiceNumber: 'INV-UNPAID', status: 'unpaid' },
        { _id: 'partial-id', invoiceNumber: 'INV-PARTIAL', status: 'partially_paid' },
        { _id: 'paid-id', invoiceNumber: 'INV-PAID', status: 'paid' }
      ]
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.items().map(invoice => invoice.invoiceNumber))
      .toEqual(['INV-UNPAID', 'INV-PARTIAL']);
  });

  it('lets an admin create an invoice from Billing and posts the completed invoice', () => {
    const fixture = createBillingWorkspace();
    const createButton = fixture.nativeElement.querySelector('.page-heading-row .button-primary') as HTMLButtonElement;
    createButton.click();
    expect(fixture.componentInstance.formOpen()).toBeTrue();

    http.expectOne('/api/patients?size=100').flush({
      items: [{ _id: 'patient-id', patientId: 'PT-001', firstName: 'Casey', lastName: 'Example' }]
    });
    http.expectOne('/api/invoices').flush({ items: [] });

    fixture.componentInstance.form.patient = 'patient-id';
    fixture.componentInstance.form.description = 'Consultation';
    fixture.componentInstance.form.unitPrice = 125;
    fixture.componentInstance.form.quantity = 2;
    fixture.componentInstance.save();

    const createRequest = http.expectOne('/api/invoices');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual({
      patient: 'patient-id',
      items: [{ description: 'Consultation', quantity: 2, unitPrice: 125 }],
      tax: 0
    });
    createRequest.flush({ invoice: { _id: 'invoice-id', invoiceNumber: 'INV-001' } });

    http.expectOne('/api/invoices').flush({ items: [] });
    spyOn(URL, 'createObjectURL').and.returnValue('blob:invoice');
    spyOn(HTMLAnchorElement.prototype, 'click').and.stub();
    http.expectOne('/api/invoices/invoice-id/pdf').flush(new Blob(['pdf']));

    expect(fixture.componentInstance.formOpen()).toBeFalse();
    expect(fixture.componentInstance.saving()).toBeFalse();
  });

  it('opens invoice creation when the dashboard shortcut adds the create action', () => {
    const fixture = createBillingWorkspace({ action: 'create' });
    expect(fixture.componentInstance.formOpen()).toBeTrue();

    http.expectOne('/api/patients?size=100').flush({ items: [] });
    http.expectOne('/api/invoices').flush({ items: [] });
  });

  it('shows a visible error and retry control when invoice loading fails', () => {
    const fixture = createBillingWorkspace();
    http.expectOne('/api/invoices').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    expect(fixture.componentInstance.listError()).toContain('Invoices could not be loaded');
    const retry = fixture.nativeElement.querySelector('.empty-table button') as HTMLButtonElement;
    expect(retry.hidden).toBeFalse();
  });
});
