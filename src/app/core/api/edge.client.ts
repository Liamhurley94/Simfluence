import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Typed wrapper for Supabase Edge Functions.
 * authInterceptor handles the bearer + apikey headers automatically.
 */
@Injectable({ providedIn: 'root' })
export class EdgeClient {
  private http = inject(HttpClient);
  private base = `${environment.supabaseUrl}/functions/v1`;

  post<TRes, TBody = unknown>(name: string, body: TBody): Promise<TRes> {
    return firstValueFrom(this.http.post<TRes>(`${this.base}/${name}`, body));
  }

  get<TRes>(name: string, params?: Record<string, string>): Promise<TRes> {
    return firstValueFrom(this.http.get<TRes>(`${this.base}/${name}`, { params }));
  }
}