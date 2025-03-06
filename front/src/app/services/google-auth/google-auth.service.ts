import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';
@Injectable({
  providedIn: 'root',
})
export class GoogleAuthService {
  private apiUrl = environment.apiUrl;
  private path = 'google';
  constructor(private http: HttpClient) {}

  loginWithGoogle(): void {
    window.location.href = `${this.apiUrl}/${this.path}/auth`;
  }
  getSession(id: string): any {
    return this.http.get<any>(`${this.apiUrl}/${this.path}/getSession/${id}`);
  }
}
