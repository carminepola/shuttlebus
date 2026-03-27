import { Component, OnInit, AfterViewInit } from '@angular/core';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { lastValueFrom } from 'rxjs';
import { StopsService } from '../../services/stops/stops.service';
import { RoutesService } from '../../services/routes/routes.service';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { FormsModule, NgForm, ReactiveFormsModule } from '@angular/forms';
import { TicketTypeService } from '../../services/ticket-type/ticket-type.service';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { AuthService } from '../../services/auth/auth.service';
import { RegistrazioneComponent } from '../../components/registrazione/registrazione.component';
import { ModalService } from '../../services/modal/modal.service';
import { BookingsService } from '../../services/bookings/bookings.service';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
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
  ) {}

  public acceptTerms: boolean = false;
  public loading: boolean = true;
  public param: any = {};
  public errorMessage: string = '';
  ngOnInit() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        localStorage.removeItem('authUrl');
        localStorage.removeItem('ticket');
        this.modalService.closeModal();
      }
    });
    localStorage.setItem('authUrl', '/riepilogo');

    const navigation = window.history.state;
    if (navigation.value) {
      this.param = navigation.value;
      this.loading = false;
      localStorage.setItem('ticket', JSON.stringify(this.param));
    } else {
      let param = localStorage.getItem('ticket');
      if (param) {
        this.param = JSON.parse(param);
        this.loading = false;
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
      this.modalService.openModal('modalLogin2');
    } else {
      this.modalService.openModal('modalLogin');
    }
  }
  goBack() {
    window.history.back();
  }

  bookNow() {
    this.errorMessage = '';
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
  isToLate() {
    const today = new Date();
    const threeDaysFromNow = new Date(
      today.getTime() + 3 * 24 * 60 * 60 * 1000,
    );
    return new Date(this.param.date).getTime() < threeDaysFromNow.getTime();
  }
}
