import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { jwtDecode } from 'jwt-decode';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiUrl = environment.apiUrl;
  private path = 'users';

  constructor(private http: HttpClient) {}

  updateOptions(options: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${this.path}/updateOptions`, {
      options,
    });
  }
  getNormalUser(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${this.path}/getNormalUser`);
  }
  register(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${this.path}/register`, data);
  }
  validateMail(data: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/${this.path}/validateEmail`,
      data,
    );
  }
  getUsers(page: number = 1, limit: number = 10): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/${this.path}?page=${page}&limit=${limit}`,
    );
  }

  getCurrentUser(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${this.path}/me`);
  }

  searchUsers(
    searchTerm: string,
    page: number = 1,
    limit: number = 10,
  ): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/${this.path}/search?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${limit}`,
    );
  }

  changePassword(
    email: string,
    oldPassword: string,
    newPassword: string,
  ): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${this.path}/changePassword`, {
      email,
      password: newPassword,
      oldPassword,
    });
  }

  updateUserDetails(name: string, phone?: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${this.path}/updateDetails`, {
      name,
      phone,
    });
  }

  getClients(page: number = 1, limit: number = 10): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/${this.path}/clients?page=${page}&limit=${limit}`,
    );
  }

  searchClients(
    searchTerm: string,
    page: number = 1,
    limit: number = 10,
  ): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/${this.path}/clients?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${limit}`,
    );
  }

  createClient(data: { email: string; password: string; name: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${this.path}/`, data);
  }

  updateClientRole(userId: string, newRole: number): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${this.path}/updateRole`, {
      userId,
      role: newRole,
    });
  }

  deleteClient(userId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${this.path}/${userId}`);
  }

  getUserById(userId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${this.path}/${userId}`);
  }

  createUser(data: { email: string; password: string; name: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${this.path}/`, data);
  }

  updateUserDetailsById(userId: string, name: string, phone?: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${this.path}/updateUserDetails`, {
      userId,
      name,
      phone,
    });
  }

  deleteUser(userId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${this.path}/${userId}`);
  }

  getNoPermissionUsers(page: number = 1, limit: number = 10): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/${this.path}/no-permission?page=${page}&limit=${limit}`,
    );
  }

  searchNoPermissionUsers(
    searchTerm: string,
    page: number = 1,
    limit: number = 10,
  ): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/${this.path}/no-permission?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${limit}`,
    );
  }
}
