import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { API_BASE_URL } from './api-url';

export interface User { id: string; name: string; email: string; role: string; }
interface LoginResponse { token: string; user: User; }
interface SignupResponse { message: string; }
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly user = signal<User | null>(this.readUser());
  get token(): string | null { return localStorage.getItem('carepoint_token'); }
  login(email: string, password: string) {
    return this.http.post<LoginResponse>(`${API_BASE_URL}/auth/login`, { email, password }).pipe(tap(result => {
      localStorage.setItem('carepoint_token', result.token);
      localStorage.setItem('carepoint_user', JSON.stringify(result.user));
      this.user.set(result.user);
    }));
  }
  signup(name: string, email: string, password: string) {
    return this.http.post<SignupResponse>(`${API_BASE_URL}/auth/signup`, { name, email, password });
  }
  logout(): void {
    localStorage.removeItem('carepoint_token');
    localStorage.removeItem('carepoint_user');
    this.user.set(null);
    void this.router.navigate(['/login']);
  }
  private readUser(): User | null {
    try { const value = localStorage.getItem('carepoint_user'); return value ? JSON.parse(value) as User : null; }
    catch { return null; }
  }
}
