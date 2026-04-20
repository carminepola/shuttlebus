import { Component, OnInit, AfterViewInit } from '@angular/core';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { lastValueFrom } from 'rxjs';
import { StopsService } from '../../services/stops/stops.service';
import { RoutesService } from '../../services/routes/routes.service';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { FormsModule, NgForm, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TicketTypeService } from '../../services/ticket-type/ticket-type.service';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { AuthService } from '../../services/auth/auth.service';
import { RegistrazioneComponent } from '../../components/registrazione/registrazione.component';
import { ModalService } from '../../services/modal/modal.service';
import { BookingsService } from '../../services/bookings/bookings.service';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { PendingBookingService } from '../../services/pending-booking/pending-booking.service';
import { GoogleAuthService } from '../../services/google-auth/google-auth.service';
import { LngService } from '../../services/lng/lng.service';
import { LUGGAGE_PRICE } from '../../constants/app.constants';
import { StepIndicatorComponent } from '../../components/step-indicator/step-indicator.component';
import * as CryptoJS from 'crypto-js';
declare var bootstrap: any;

@Component({
  selector: 'app-riepilogo',
  imports: [
    LoadingComponent,
    TranslatePipe,
    TranslateNamePipe,
    CommonModule,
    ReactiveFormsModule,
    TitlePageComponent,
    StepIndicatorComponent,
    FormsModule,
    FooterComponent,
  ],
  templateUrl: './riepilogo.component.html',
  styleUrl: './riepilogo.component.scss',
})
export class RiepilogoComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private modalService: ModalService,
    private bookingService: BookingsService,
    private pendingBookingService: PendingBookingService,
    private googleAuthService: GoogleAuthService,
    private lngService: LngService,
    private formBuilder: FormBuilder,
  ) {}

  public acceptTerms: boolean = false;
  public confirmDuplicateTicket: boolean = false;
  public hasDuplicateTicket: boolean = false;
  public loading: boolean = true;
  public luggagePrice = LUGGAGE_PRICE;
  public funnelSteps = ['str_step_search', 'str_step_select', 'str_step_review', 'str_step_pay'];
  public param: any = {};
  public errorMessage: string = '';
  public checkoutLoginForm!: FormGroup;
  public checkoutLoginSubmitted = false;
  public checkoutLoginLoading = false;
  public checkoutLoginError = '';
  async ngOnInit() {
    this.checkoutLoginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        localStorage.removeItem('authUrl');
        localStorage.removeItem('ticket');
        this.modalService.closeModal();
      }
    });
    localStorage.setItem('authUrl', '/riepilogo');

    const pendingBooking = await this.pendingBookingService.hasPendingBooking();
    if (pendingBooking) {
      const shouldContinue = await this.pendingBookingService.showPendingModal();
      if (shouldContinue) {
        this.router.navigate(['/user/mytickets']);
        return;
      } else {
        await this.pendingBookingService.cancelPendingBooking(pendingBooking);
      }
    }

    const navigation = window.history.state;
    if (navigation.value) {
      this.param = navigation.value;
      localStorage.setItem('ticket', JSON.stringify(this.param));
      this.loading = false;
      this.checkDuplicateTicket();
    } else {
      let param = localStorage.getItem('ticket');
      if (param) {
        this.param = JSON.parse(param);
        this.loading = false;
        this.checkDuplicateTicket();
      } else {
        this.router.navigate(['/']);
      }
    }
  }
  isLoggedIn() {
    return this.authService.isLoggedIn();
  }
  myModal: any;
  openModal(type: boolean) {
    if (type) {
      this.modalService.openModal('modalLogin2', 'register');
    } else {
      this.modalService.openModal('modalLogin');
    }
  }
  goBack() {
    window.history.back();
  }

  async bookNow() {
    const pendingBooking = await this.pendingBookingService.hasPendingBooking();
    if (pendingBooking) {
      const shouldContinue = await this.pendingBookingService.showPendingModal();
      if (shouldContinue) {
        this.router.navigate(['/user/mytickets']);
        return;
      } else {
        await this.pendingBookingService.cancelPendingBooking(pendingBooking);
      }
    }

    this.errorMessage = '';

    if (this.hasDuplicateTicket && !this.confirmDuplicateTicket) {
      this.errorMessage = 'str_error_confirm_duplicate_ticket';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.bookingService.insertBooking(this.param).subscribe({
      next: (response: any) => {
        console.log(response);
        this.loading = false;
        window.location.href = response.url;
      },
      error: (e: any) => {
        this.errorMessage = e.error.message || e.message;
        this.loading = false;
      },
    });
  }
  async checkDuplicateTicket() {
    if (!this.authService.isLoggedIn() || !this.param?.routeId || !this.param?.date || !this.param?.from?.id || !this.param?.to?.id) {
      return;
    }
    try {
      const res = await lastValueFrom(this.bookingService.getBookingFromUser());
      const bookings = res['booking'] || [];
      this.hasDuplicateTicket = bookings.some((b: any) =>
        (b.status === 'confirmed' || b.status === 'pending') &&
        b.routeId === this.param.routeId &&
        b.date === this.param.date &&
        b.from?.id === this.param.from.id &&
        b.to?.id === this.param.to.id
      );
    } catch {
      this.hasDuplicateTicket = false;
    }
  }

  isToLate() {
    const today = new Date();
    const threeDaysFromNow = new Date(
      today.getTime() + 3 * 24 * 60 * 60 * 1000,
    );
    return new Date(this.param.date).getTime() < threeDaysFromNow.getTime();
  }

  get checkoutEmailField() {
    return this.checkoutLoginForm.get('email')!;
  }

  get checkoutPasswordField() {
    return this.checkoutLoginForm.get('password')!;
  }

  loginWithGoogle() {
    localStorage.setItem('authUrl', '/riepilogo');
    this.googleAuthService.loginWithGoogle();
  }

  onQuickLogin(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.checkoutLoginSubmitted = true;
    this.checkoutLoginError = '';

    if (this.checkoutLoginForm.invalid) {
      return;
    }

    this.checkoutLoginLoading = true;
    const { email, password } = this.checkoutLoginForm.value;
    const md5Password = CryptoJS.MD5(password).toString();

    this.authService.login(email, md5Password, false).subscribe({
      next: () => {
        this.checkoutLoginLoading = false;
        this.checkoutLoginError = '';
        this.checkDuplicateTicket();
      },
      error: (e: any) => {
        this.checkoutLoginLoading = false;
        this.checkoutLoginError = this.lngService.traslate('str_login_error');
      },
    });
  }
}
