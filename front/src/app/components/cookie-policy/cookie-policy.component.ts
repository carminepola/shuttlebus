import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';

import { Router } from '@angular/router';
import { TranslatePipe } from '../../pipe/translate.pipe';
@Component({
  selector: 'app-cookie-policy',
  imports: [TranslatePipe],
  templateUrl: './cookie-policy.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './cookie-policy.component.scss',
})
export class CookiePolicyComponent implements OnInit, OnDestroy {
  private static readonly AUTO_DISMISS_MS = 5000;

  public show: boolean = false;
  private autoDismissTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private router: Router) {}

  ngOnInit(): void {
    const choice = localStorage.getItem('cookie');
    if (choice === 'true' || choice === 'false') {
      this.show = false;
      return;
    }
    this.show = true;
    this.startAutoDismiss();
  }

  ngOnDestroy(): void {
    this.clearAutoDismiss();
  }

  acceptCookies() {
    localStorage.setItem('cookie', 'true');
    this.hide();
  }

  rejectCookies() {
    localStorage.setItem('cookie', 'false');
    this.hide();
  }

  autoDismiss() {
    this.hide();
  }

  goToPolicy() {
    this.router.navigate(['/info/privacy-policy']);
  }

  private startAutoDismiss() {
    this.autoDismissTimer = setTimeout(
      () => this.hide(),
      CookiePolicyComponent.AUTO_DISMISS_MS
    );
  }

  private hide() {
    this.show = false;
    this.clearAutoDismiss();
  }

  private clearAutoDismiss() {
    if (this.autoDismissTimer !== null) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
  }
}
