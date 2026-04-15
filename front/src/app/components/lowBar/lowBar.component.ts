import {
  Component,
  AfterViewInit,
  ViewChildren,
  QueryList,
  ElementRef,
  OnDestroy,
  NgZone,
} from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { CommonModule } from '@angular/common';
import { LoginFormComponent } from '../login-form/login-form.component';
import { RegistrazioneComponent } from '../registrazione/registrazione.component';
import { ModalService } from '../../services/modal/modal.service';

@Component({
  selector: 'app-lowBar',
  imports: [
    RouterModule,
    CommonModule,
    LoginFormComponent,
    RegistrazioneComponent,
  ],
  templateUrl: './lowBar.component.html',
  styleUrl: './lowBar.component.scss',
  standalone: true,
})
export class LowBarComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('navLink') navLinks!: QueryList<ElementRef<HTMLAnchorElement>>;
  private indicatorEl: HTMLElement | null = null;
  private containerEl: HTMLElement | null = null;
  private resizeObs: ResizeObserver | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private modalService: ModalService,
    private ngZone: NgZone,
  ) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.modalService.closeModal();
        setTimeout(() => this.updateIndicator(), 0);
      }
    });
    this.modalService.getTabState().subscribe((tab) => {
      this.login = tab !== 'register';
    });
  }

  public login: boolean = true;

  getPath(): string {
    return this.router.url;
  }

  ngAfterViewInit(): void {
    this.indicatorEl = document.querySelector('.lowbar-indicator');
    this.containerEl = document.querySelector('#lowBar .row');

    setTimeout(() => this.updateIndicator(), 0);

    this.resizeObs = new ResizeObserver(() => {
      this.ngZone.run(() => this.updateIndicator());
    });

    if (this.containerEl) {
      this.resizeObs.observe(this.containerEl);
    }
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
  }

  onNavMouseEnter(el: HTMLAnchorElement): void {
    this.moveIndicator(el);
  }

  onNavMouseLeave(): void {
    this.updateIndicator();
  }

  private moveIndicator(el: HTMLAnchorElement): void {
    if (!this.indicatorEl || !this.containerEl) return;
    const col = el.closest('.col') as HTMLElement;
    if (!col) return;
    const containerRect = this.containerEl.getBoundingClientRect();
    const colRect = col.getBoundingClientRect();
    this.indicatorEl.style.width = colRect.width + 'px';
    this.indicatorEl.style.left = colRect.left - containerRect.left + 'px';
    this.indicatorEl.style.opacity = '1';
  }

  updateIndicator(): void {
    if (!this.indicatorEl || !this.navLinks) return;
    const active = this.navLinks.find((ref) =>
      ref.nativeElement.classList.contains('active'),
    );
    if (active) {
      this.moveIndicator(active.nativeElement);
    } else {
      this.indicatorEl.style.opacity = '0';
    }
  }

  onEvent() {
    this.modalService.closeModal();
  }

  onComplete() {
    this.login = true;

    let page = localStorage.getItem('authUrl');
    if (page) {
      localStorage.removeItem('authUrl');
      this.router.navigateByUrl(page);
      this.modalService.closeModal();
    }
    this.modalService.closeModal();
  }

  goPath(path: string) {
    this.router.navigate([path]);
  }
  isLoggedIn() {
    return this.authService.isLoggedIn();
  }

  onTicket() {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/user/account']);
    } else {
      this.modalService.openModal('modalLogin2');
    }
  }
}
