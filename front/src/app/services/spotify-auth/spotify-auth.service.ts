import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
@Injectable({
  providedIn: 'root',
})
export class SpotifyAuthService {
  private apiUrl = environment.apiUrl;
  private path = 'spotify';
  constructor(private http: HttpClient) {}

  loginWithSpotify(): void {
    window.location.href = `${this.apiUrl}/${this.path}/auth`;
  }
  getSession(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${this.path}/getSession/${id}`);
  }
}
