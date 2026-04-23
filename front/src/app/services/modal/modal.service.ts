import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

declare var bootstrap: any;

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  private modalInstance: any = null;
  private modalSubject = new BehaviorSubject<boolean>(false);
  private tabSubject = new BehaviorSubject<string>('login');

  constructor() {}

  openModal(modalId: string, tab?: string) {
    if (tab) {
      this.tabSubject.next(tab);
    } else {
      this.tabSubject.next('login');
    }
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      this.modalInstance = new bootstrap.Modal(modalElement);
      this.modalInstance.show();
      this.modalSubject.next(true);
    }
  }

  getTabState() {
    return this.tabSubject.asObservable();
  }

  closeModal() {
    if (this.modalInstance) {
      this.modalInstance.hide();
      this.modalSubject.next(false);
      this.removeModalBackdrop();
    }
  }

  getModalState() {
    return this.modalSubject.asObservable();
  }

  private removeModalBackdrop() {
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.remove();
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
  }
}
