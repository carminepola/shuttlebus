import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment.development';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class LngService {
  private apiUrl = environment.apiUrl + '/lng';

  constructor(private http: HttpClient) {}

  get(): Observable<any> {
    return this.http.get(this.apiUrl).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  traslate(id: string) {
    let obj = JSON.parse(localStorage['lng']);
    if (obj.length > 0) {
      let find = obj.find((x: any) => {
        x.text == id;
      });
      if (find) {
        return find;
      }
      return id;
    }
  }
}
