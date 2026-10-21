import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'hm-signup',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="login-page">
      <section class="login-art"><a class="brand brand-light" routerLink="/login"><span class="brand-mark"><span class="material-icons">add</span></span><span>carepoint<small>HOSPITAL MANAGEMENT</small></span></a><div class="login-message"><div class="eyebrow"><span></span> CARE THAT CONNECTS</div><h1>Join your<br><em>care team.</em></h1><p>Request secure access to the Carepoint hospital workspace.</p></div><div class="login-art-foot">DESIGNED FOR THE PEOPLE WHO CARE.</div></section>
      <section class="login-form-side"><div class="login-form-wrap"><div class="eyebrow form-eyebrow">STAFF ACCOUNT REQUEST</div><h2>Request an account</h2><p class="login-subtitle">New requests need administrator approval before sign-in.</p>
        <form [formGroup]="form" (ngSubmit)="submit()"><label for="name">Full name</label><div class="field-wrap"><span class="material-icons">person_outline</span><input id="name" type="text" formControlName="name" placeholder="Your full name" autocomplete="name" required></div><label for="email">Work email</label><div class="field-wrap"><span class="material-icons">mail_outline</span><input id="email" type="email" formControlName="email" placeholder="you@hospital.com" autocomplete="email" required></div><label for="password">Password (at least 12 characters)</label><div class="field-wrap"><span class="material-icons">lock_outline</span><input id="password" type="password" formControlName="password" autocomplete="new-password" required></div>
          <div class="login-error" [hidden]="!error()">{{ error() }}</div><div class="login-success" [hidden]="!success()">{{ success() }}</div><button class="sign-in-button" type="submit" [disabled]="loading() || form.invalid">{{ loading() ? 'Submitting…' : 'Request account' }}<span class="material-icons">arrow_forward</span></button>
        </form><div class="login-help">Already have an account? <a routerLink="/login">Sign in</a></div></div><div class="login-legal">Account access is reviewed by your hospital administrator.</div></section>
    </main>`
})
export class SignupComponent {
  private readonly auth = inject(AuthService);
  readonly form = inject(FormBuilder).nonNullable.group({ name: ['', [Validators.required, Validators.minLength(2)]], email: ['', [Validators.required, Validators.email]], password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128)]] });
  readonly loading = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true); this.error.set(''); this.success.set('');
    const { name, email, password } = this.form.getRawValue();
    this.auth.signup(name, email, password).subscribe({
      next: result => { this.loading.set(false); this.success.set(result.message); this.form.reset(); },
      error: (err: HttpErrorResponse) => { this.loading.set(false); this.error.set(err.status === 0 || err.status >= 500 ? 'The hospital server is unavailable. Please try again later.' : err.error?.message || 'Account request could not be submitted.'); }
    });
  }
}
