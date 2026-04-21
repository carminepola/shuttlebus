import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ConfirmModalConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmClass?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ConfirmModalService {
  private configSubject = new BehaviorSubject<ConfirmModalConfig | null>(null);
  private resultCallback: ((confirmed: boolean) => void) | null = null;

  get config$() {
    return this.configSubject.asObservable();
  }

  open(config: ConfirmModalConfig): Promise<boolean> {
    return new Promise((resolve) => {
      this.configSubject.next(config);
      this.resultCallback = resolve;
    });
  }

  confirm(): void {
    this.configSubject.next(null);
    if (this.resultCallback) {
      this.resultCallback(true);
      this.resultCallback = null;
    }
  }

  cancel(): void {
    this.configSubject.next(null);
    if (this.resultCallback) {
      this.resultCallback(false);
      this.resultCallback = null;
    }
  }
}
