import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-url';

export interface PageResult<T> { items: T[]; page: number; pageSize: number; total: number; }
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_URL;
  get<T>(path: string, params?: Record<string, string | number>): Observable<T> {
    let query = new HttpParams();
    for (const [key, value] of Object.entries(params ?? {})) query = query.set(key, value);
    return this.http.get<T>(`${this.base}/${path}`, { params: query });
  }
  getBlob(path: string): Observable<Blob> { return this.http.get(`${this.base}/${path}`, { responseType: 'blob' }); }
  post<T>(path: string, body: unknown): Observable<T> { return this.http.post<T>(`${this.base}/${path}`, body); }
  patch<T>(path: string, body: unknown): Observable<T> { return this.http.patch<T>(`${this.base}/${path}`, body); }
  delete(path: string): Observable<void> { return this.http.delete<void>(`${this.base}/${path}`); }
}
