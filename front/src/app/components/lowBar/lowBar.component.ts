import {
  Component,
  AfterViewInit,
  ViewChildren,
  QueryList,
  ElementRef,
  OnDestroy,
  NgZone,
  ChangeDetectionStrategy
} from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { CommonModule } from '@angular/common';
import { LoginFormComponent } from '../login-form/login-form.component';
import { RegistrazioneComponent } from '../registrazione/registrazione.component';
import { ModalService } from '../../services/modal/modal.service';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { TourGuideService } from '../../services/tour-guide/tour-guide.service';
import { Subscription } from 'rxjs';
import { BRAND_VIEW } from '../../../brand';

@Component({
  selector: 'app-lowBar',
  imports: [
    RouterModule,
    CommonModule,
    LoginFormComponent,
    RegistrazioneComponent,
    TranslatePipe,
  ],
  templateUrl: './lowBar.component.html',
  styleUrl: './lowBar.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
})
export class LowBarComponent implements AfterViewInit, OnDestroy {
  readonly brand = BRAND_VIEW;
  @ViewChildren('navLink') navLinks!: QueryList<ElementRef<HTMLAnchorElement>>;
  private indicatorEl: HTMLElement | null = null;
  private containerEl: HTMLElement | null = null;
  private resizeObs: ResizeObserver | null = null;
  private tourSub: Subscription | null = null;
  showTour = false;
  /** Posizione di evidenziazione e fumetto, calcolata dal pulsante account visibile. */
  tour: {
    highlight: { top: number; left: number; width: number; height: number };
    popover: { top: number; left: number };
    arrowLeft: number;
    below: boolean;
  } | null = null;
  private readonly onResize = () => {
    if (this.showTour) this.ngZone.run(() => (this.tour = this.computeTour()));
  };

  constructor(
    private router: Router,
    private authService: AuthService,
    private modalService: ModalService,
    private ngZone: NgZone,
    private tourGuideService: TourGuideService,
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
    window.addEventListener('resize', this.onResize);

    this.tourSub = this.tourGuideService.getTourVisible().subscribe((v) => {
      this.showTour = v;
      this.tour = v ? this.computeTour() : null;
      // l'elemento puo' non essere ancora al suo posto (animazioni): ricalcolo
      if (v) setTimeout(() => (this.tour = this.computeTour()), 300);
    });
  }

  /**
   * La guida indica il pulsante account visibile: barra in basso su mobile
   * (#tour-account-icon), navbar in alto su desktop (#tour-account-nav). Prima era
   * posizionata in modo fisso per il mobile e su desktop evidenziava uno spazio vuoto.
   */
  private computeTour() {
    const target = ['tour-account-icon', 'tour-account-nav']
      .map((id) => document.getElementById(id))
      .find((el) => !!el && el.getBoundingClientRect().width > 0);
    if (!target) return null;
    const r = target.getBoundingClientRect();
    const pad = 4;
    const popoverWidth = Math.min(320, window.innerWidth - 32);
    const center = r.left + r.width / 2;
    const left = Math.max(16, Math.min(center - popoverWidth / 2, window.innerWidth - popoverWidth - 16));
    const below = r.top < window.innerHeight / 2; // pulsante in alto: fumetto sotto
    return {
      highlight: { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 },
      popover: { top: below ? r.bottom + 16 : r.top - 16, left },
      arrowLeft: Math.max(20, Math.min(center - left, popoverWidth - 20)),
      below,
    };
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.resizeObs?.disconnect();
    this.tourSub?.unsubscribe();
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
    this.tourGuideService.startTicketTour();
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
    this.tourGuideService.startTicketTour();
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

  dismissTour() {
    this.tourGuideService.dismissTour();
  }
}
