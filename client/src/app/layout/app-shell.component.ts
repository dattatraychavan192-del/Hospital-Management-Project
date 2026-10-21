import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';

@Component({ selector: 'hm-app-shell', standalone: true, imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, RouterOutlet], template: `
<div class="app-frame" [class.nav-open]="menuOpen()">
  <aside class="sidebar">
    <a class="brand" routerLink="/"><span class="brand-mark"><span class="material-icons">add</span></span><span>carepoint<small>HOSPITAL MANAGEMENT</small></span></a>
    <div class="nav-label">WORKSPACE</div>
    <nav class="main-nav">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}"><span class="material-icons">grid_view</span>Overview</a>
      <a routerLink="/patients" routerLinkActive="active"><span class="material-icons">groups</span>Patients</a>
      <a routerLink="/appointments" routerLinkActive="active"><span class="material-icons">calendar_month</span>Appointments</a>
      <a *ngIf="auth.user()?.role === 'admin' || auth.user()?.role === 'doctor' || auth.user()?.role === 'receptionist'" routerLink="/doctors" routerLinkActive="active"><span class="material-icons">medical_services</span>Doctors</a>
      <a *ngIf="auth.user()?.role === 'admin' || auth.user()?.role === 'doctor' || auth.user()?.role === 'nurse'" routerLink="/records" routerLinkActive="active"><span class="material-icons">description</span>Medical records</a>
      <a *ngIf="auth.user()?.role === 'admin' || auth.user()?.role === 'billing'" routerLink="/billing" routerLinkActive="active"><span class="material-icons">receipt_long</span>Billing</a>
      <a *ngIf="auth.user()?.role === 'admin' || auth.user()?.role === 'pharmacist' || auth.user()?.role === 'nurse'" routerLink="/pharmacy" routerLinkActive="active"><span class="material-icons">medication</span>Pharmacy</a>
      <a *ngIf="auth.user()?.role === 'admin'" routerLink="/reports" routerLinkActive="active"><span class="material-icons">bar_chart</span>Reports</a>
    </nav>
    <div *ngIf="auth.user()?.role === 'admin'" class="nav-label nav-label-team">MANAGEMENT</div>
    <nav *ngIf="auth.user()?.role === 'admin'" class="main-nav"><a routerLink="/staff" routerLinkActive="active"><span class="material-icons">medical_services</span>Care team</a></nav>
    <div class="sidebar-bottom"><div class="help-card"><div class="help-icon"><span class="material-icons">support_agent</span></div><strong>Need a hand?</strong><p>Our support team is here to help.</p><a href="mailto:support@carepoint.local">Get in touch <span>â†—</span></a></div>
      <button class="profile-row" (click)="auth.logout()"><span class="avatar">{{ initials }}</span><span class="profile-copy"><strong>{{ auth.user()?.name || 'Care team' }}</strong><small>{{ auth.user()?.role || 'staff' }}</small></span><span class="material-icons profile-exit">logout</span></button>
    </div>
  </aside>
  <main class="main-area"><header class="topbar"><button class="icon-button mobile-menu" aria-label="Toggle navigation" (click)="menuOpen.set(!menuOpen())"><span class="material-icons">menu</span></button><div class="breadcrumb">Carepoint <span>/</span> <strong>{{ title }}</strong></div><div class="topbar-actions"><span class="today-label"><span class="material-icons">today</span>{{ today }}</span><span class="top-divider"></span><button class="icon-button notification" aria-label="Notifications"><span class="material-icons">notifications_none</span><i></i></button><div class="account-area"><button class="avatar top-avatar account-trigger" aria-label="Account options" [attr.aria-expanded]="accountMenuOpen()" (click)="accountMenuOpen.set(!accountMenuOpen())">{{ initials }}</button><section *ngIf="accountMenuOpen()" class="account-menu"><strong>{{ auth.user()?.name }}</strong><small>{{ auth.user()?.email }}</small><span class="account-role">{{ auth.user()?.role }}</span><button type="button" (click)="openPasswordChange()"><span class="material-icons">key</span> Change password</button><button type="button" (click)="auth.logout()"><span class="material-icons">logout</span> Sign out</button></section></div></div></header><section class="page-content"><router-outlet /></section><footer class="app-footer"><span>Â© {{ year }} Carepoint Health</span><span>Better care, together <span class="footer-heart">â™¥</span></span></footer></main>
</div><div class="mobile-scrim" (click)="menuOpen.set(false)"></div>
<div *ngIf="changePasswordOpen()" class="modal-backdrop account-backdrop" (click)="changePasswordOpen.set(false)"><section class="form-modal password-modal" (click)="$event.stopPropagation()"><div class="modal-heading"><div><div class="eyebrow"><span></span> ACCOUNT SECURITY</div><h2>Change password</h2><p>Choose a new password with at least 12 characters.</p></div><button type="button" class="icon-button" aria-label="Close" (click)="changePasswordOpen.set(false)"><span class="material-icons">close</span></button></div><form (ngSubmit)="changePassword()"><div class="form-grid account-form-grid"><label class="full-field">Current password<input type="password" name="currentPassword" [(ngModel)]="passwordForm.currentPassword" autocomplete="current-password" required></label><label class="full-field">New password<input type="password" name="newPassword" [(ngModel)]="passwordForm.newPassword" autocomplete="new-password" minlength="12" required></label><label class="full-field">Confirm new password<input type="password" name="confirmPassword" [(ngModel)]="passwordForm.confirmPassword" autocomplete="new-password" minlength="12" required></label></div><div class="login-error" [hidden]="!passwordError()">{{ passwordError() }}</div><div class="login-success" [hidden]="!passwordSuccess()">{{ passwordSuccess() }}</div><div class="modal-actions"><button type="button" class="button-secondary" (click)="changePasswordOpen.set(false)">Cancel</button><button type="submit" class="button-primary" [disabled]="passwordSaving()">{{ passwordSaving() ? 'Updating...' : 'Update password' }}</button></div></form></section></div>
` })
export class AppShellComponent {
  private readonly api = inject(ApiService);
  readonly menuOpen = signal(false);
  readonly accountMenuOpen = signal(false);
  readonly changePasswordOpen = signal(false);
  readonly passwordSaving = signal(false);
  readonly passwordError = signal('');
  readonly passwordSuccess = signal('');
  passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
  readonly today = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
  readonly year = new Date().getFullYear();
  get title(): string { const path = location.pathname.split('/')[1]; return ({ patients: 'Patients', appointments: 'Appointments', doctors: 'Doctors', records: 'Medical records', billing: 'Billing', pharmacy: 'Pharmacy', reports: 'Reports', staff: 'Care team' } as Record<string, string>)[path] || 'Overview'; }
  get initials(): string { return (this.auth.user()?.name || 'Care Team').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase(); }
  openPasswordChange(): void { this.accountMenuOpen.set(false); this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' }; this.passwordError.set(''); this.passwordSuccess.set(''); this.changePasswordOpen.set(true); }
  changePassword(): void {
    this.passwordError.set(''); this.passwordSuccess.set('');
    if (this.passwordForm.newPassword.length < 12) { this.passwordError.set('New password must be at least 12 characters.'); return; }
    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) { this.passwordError.set('New password and confirmation do not match.'); return; }
    this.passwordSaving.set(true);
    this.api.patch<{ message: string }>('auth/password', { currentPassword: this.passwordForm.currentPassword, newPassword: this.passwordForm.newPassword }).subscribe({
      next: result => { this.passwordSaving.set(false); this.passwordSuccess.set(result.message); this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' }; },
      error: (err: { error?: { message?: string } }) => { this.passwordSaving.set(false); this.passwordError.set(err.error?.message || 'Password could not be updated.'); }
    });
  }
  constructor(readonly auth: AuthService) {}
}

