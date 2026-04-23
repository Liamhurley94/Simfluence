import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Typed wrapper for Supabase PostgREST.
 * authInterceptor handles the bearer + apikey headers automatically.
 */
@Injectable({ providedIn: 'root' })
export class RestClient {
  private http = inject(HttpClient);
  private base = `${environment.supabaseUrl}/rest/v1`;

  get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${this.base}${path}`, { params }));
  }

  post<T, B = unknown>(path: string, body: B, minimal = false): Promise<T> {
    const headers = minimal
      ? new HttpHeaders({ Prefer: 'return=minimal' })
      : undefined;
    return firstValueFrom(this.http.post<T>(`${this.base}${path}`, body, { headers }));
  }
}