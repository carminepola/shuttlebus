import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SidebarService {
  private isSidebarOpen = new Subject<boolean>();

  // Observable per ottenere lo stato della sidebar
  isSidebarOpen$ = this.isSidebarOpen.asObservable();

  // Metodo per aprire la sidebar
  openSidebar() {
    this.isSidebarOpen.next(true);
  }

  // Metodo per chiudere la sidebar
  closeSidebar() {
    this.isSidebarOpen.next(false);
  }
}
