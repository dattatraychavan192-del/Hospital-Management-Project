import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PatientsComponent } from './pages/patients.component';

describe('PatientsComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [PatientsComponent],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
  }));

  it('validates patient registration before submission', () => {
    const fixture = TestBed.createComponent(PatientsComponent);
    const component = fixture.componentInstance;
    expect(component.form.invalid).toBeTrue();
    component.form.setValue({ firstName: 'Sam', lastName: 'Taylor', dateOfBirth: '1990-01-01', gender: 'other', phone: '+91 98765 43210', email: '', bloodGroup: 'unknown' });
    expect(component.form.valid).toBeTrue();
    component.form.controls.phone.setValue('bad phone number');
    expect(component.form.controls.phone.invalid).toBeTrue();
  });

  it('explains invalid optional email instead of silently rejecting the form', () => {
    const fixture = TestBed.createComponent(PatientsComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/patients?p=1&size=20&q=').flush({ items: [], page: 1, pageSize: 20, total: 0 });
    component.form.setValue({ firstName: 'Sam', lastName: 'Taylor', dateOfBirth: '1990-01-01', gender: 'other', phone: '9876543210', email: 'samexample.com', bloodGroup: 'unknown' });

    component.save();

    expect(component.error()).toBe('Enter a valid email address or leave this field blank.');
    http.expectNone(request => request.method === 'POST' && request.url === '/api/patients');
    fixture.destroy();
  });

  it('reloads the list and displays a patient after successful registration', () => {
    const fixture = TestBed.createComponent(PatientsComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/patients?p=1&size=20&q=').flush({ items: [], page: 1, pageSize: 20, total: 0 });
    component.form.setValue({ firstName: 'Sam', lastName: 'Taylor', dateOfBirth: '1990-01-01', gender: 'other', phone: '9876543210', email: '', bloodGroup: 'unknown' });
    const patient = { _id: 'patient-id', patientId: 'PT-TEST1234', firstName: 'Sam', lastName: 'Taylor', dateOfBirth: '1990-01-01', gender: 'other', phone: '9876543210', bloodGroup: 'unknown', createdAt: '2026-10-17T00:00:00.000Z' };

    component.save();
    http.expectOne('/api/patients').flush({ patient });
    http.expectOne('/api/patients?p=1&size=20&q=').flush({ items: [patient], page: 1, pageSize: 20, total: 1 });

    expect(component.formOpen()).toBeFalse();
    expect(component.patients()).toEqual([patient]);
    expect(component.total()).toBe(1);
    fixture.destroy();
  });
});
