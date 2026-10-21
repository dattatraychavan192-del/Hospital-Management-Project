import { HttpErrorResponse } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let login: jasmine.Spy;

  beforeEach(() => {
    login = jasmine.createSpy('login').and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500 }))
    );
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { login } }
      ]
    });
  });

  it('explains when the backend or database is unavailable', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.form.setValue({ email: 'staff@example.test', password: 'password' });

    fixture.componentInstance.submit();

    expect(login).toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toContain('backend and database are running');
  });

  it('shows the API message for invalid credentials', () => {
    login.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 401,
      error: { message: 'Email or password is incorrect.' }
    })));
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.form.setValue({ email: 'staff@example.test', password: 'wrong-password' });

    fixture.componentInstance.submit();

    expect(fixture.componentInstance.error()).toBe('Email or password is incorrect.');
  });
});
