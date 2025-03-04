import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
@Injectable({
  providedIn: 'root',
})
export class ImagesService {
  private apiUrl = environment.apiUrl + '/images';

  constructor(private http: HttpClient) {}

  upload(files: any): Observable<any> {
    let f: FormData = new FormData();
    f.append('images', files);
    return this.http.post(`${this.apiUrl}`, f);
  }

  get(name: string) {
    return environment.apiUrl + '/images/' + name;
  }
}
