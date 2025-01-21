import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { jwtDecode } from 'jwt-decode';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = environment.apiUrl;
  private path = 'users';

  constructor(private http: HttpClient) { }

  updateOptions(options: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${this.path}/updateOptions`, { options });
  }
}
