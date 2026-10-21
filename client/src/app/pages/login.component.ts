import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({ selector: 'hm-login', standalone: true, imports: [ReactiveFormsModule, RouterLink], template: `
<main class="login-page"><section class="login-art"><a class="brand brand-light"><span class="brand-mark"><span class="material-icons">add</span></span><span>carepoint<small>HOSPITAL MANAGEMENT</small></span></a><div class="login-message"><div class="eyebrow"><span></span> CARE THAT CONNECTS</div><h1>Good care starts<br>with a <em>clear picture.</em></h1><p>One thoughtful workspace for your team to focus on what matters most: your patients.</p><div class="art-card"><div class="art-card-head"><span class="art-dot"></span> TODAY AT CAREPOINT <span class="art-card-date">{{ today }}</span></div><div class="art-row"><span class="art-time">09:30</span><span class="art-person teal">AM</span><span class="art-details"><b>Alex Morgan</b><small>General consultation · Dr. Patel</small></span><span class="art-status">CONFIRMED</span></div><div class="art-row"><span class="art-time">10:15</span><span class="art-person coral">JW</span><span class="art-details"><b>Jamie Williams</b><small>Follow-up visit · Dr. Chen</small></span><span class="art-status">CHECKED IN</span></div><div class="art-row"><span class="art-time">11:00</span><span class="art-person violet">RP</span><span class="art-details"><b>Riley Parker</b><small>Annual physical · Dr. Patel</small></span><span class="art-status">UP NEXT</span></div><div class="art-foot"><span class="material-icons">verified_user</span> Your patients' care, thoughtfully managed.</div></div></div><div class="login-art-foot">DESIGNED FOR THE PEOPLE WHO CARE.</div></section>
<section class="login-form-side"><div class="login-form-wrap"><div class="eyebrow form-eyebrow">WELCOME BACK</div><h2>Sign in to Carepoint</h2><p class="login-subtitle">Enter your credentials to access your workspace.</p><form [formGroup]="form" (ngSubmit)="submit()"><label for="email">Work email</label><div class="field-wrap"><span class="material-icons">mail_outline</span><input id="email" type="email" formControlName="email" placeholder="you@hospital.com" required autocomplete="username"></div><label for="password">Password</label><div class="field-wrap"><span class="material-icons">lock_outline</span><input id="password" [type]="showPassword() ? 'text' : 'password'" formControlName="password" placeholder="Enter your password" required autocomplete="current-password"><button type="button" class="show-password" (click)="showPassword.set(!showPassword())">{{ showPassword() ? 'Hide' : 'Show' }}</button></div><div class="login-error" [hidden]="!error()">{{ error() }}</div><button class="sign-in-button" type="submit" [disabled]="loading() || form.invalid">{{ loading() ? 'Signing in…' : 'Sign in' }}<span class="material-icons">arrow_forward</span></button></form><div class="login-security"><span class="material-icons">shield</span><span><b>Your information is protected</b><small>Secure, encrypted access for authorized care teams.</small></span></div><div class="login-help">Need an account? <a routerLink="/signup">Sign up</a>. <a href="mailto:support@carepoint.local">Contact support</a></div></div><div class="login-legal">By signing in, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.</div></section></main>
` })
export class LoginComponent {
  private readonly auth = inject(AuthService); private readonly router = inject(Router);
  readonly form = inject(FormBuilder).nonNullable.group({ email: ['', [Validators.required, Validators.email]], password: ['', Validators.required] });
  readonly loading = signal(false); readonly showPassword = signal(false); readonly error = signal('');
  readonly today = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const { email, password } = this.form.getRawValue();
    this.loading.set(true); this.error.set('');
    this.auth.login(email, password).subscribe({
      next: () => { this.loading.set(false); void this.router.navigate(['/']); },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err.status === 0 || err.status >= 500
          ? 'The hospital server is unavailable. Check that the backend and database are running, then try again.'
          : err.error?.message || 'Unable to sign in. Please check your credentials and try again.');
      }
    });
  }
}
