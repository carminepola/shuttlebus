import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface OAuthProviders {
  google: boolean;
  microsoft: boolean;
  facebook: boolean;
  spotify: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class OAuthProvidersService {
  private apiUrl = environment.apiUrl;
  private path = 'providers';
  constructor(private http: HttpClient) {}

  getProviders(): Observable<{ providers: OAuthProviders }> {
    return this.http.get<{ providers: OAuthProviders }>(`${this.apiUrl}/${this.path}`);
  }
}
