import { Component, OnInit, EventEmitter, Output } from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';

import { FormsModule, ReactiveFormsModule, NgForm } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { UserService } from '../../services/user/user.service';
import * as CryptoJS from 'crypto-js';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { LngService } from '../../services/lng/lng.service';

@Component({
  selector: 'app-registrazione',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    TranslatePipe,
    FormsModule,
  ],
  templateUrl: './registrazione.component.html',
  styleUrl: './registrazione.component.scss',
})
export class RegistrazioneComponent implements OnInit {
  isSubmitted = false;
  loginError = '';
  isLoading = false;
  privacy = false;
  pinMode = false;
  pin = '';
  public loginForm = {
    email: '',
    password: '',
    name: '',
    repeatEmail: '',
    repeatPassword: '',
    phoneNumber: '',
    prefixPhone: '',
  };

  @Output() registerSuccess = new EventEmitter<void>();
  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService,
    private lngService: LngService
  ) {}

  async getPhonePrefix() {
    const regionPrefixes: any = {
      US: '+1',
      GB: '+44',
      IT: '+39',
      FR: '+33',
      DE: '+49',
      ES: '+34',
      CA: '+1',
      JP: '+81',
      CN: '+86',
      IN: '+91',
      RU: '+7',
      BR: '+55',
      AU: '+61',
      PT: '+351',
    };

    // STEP 1: tentativo con la lingua del browser
    const locale = navigator.language; // es: "it-IT"
    const region = locale.split('-')[1]?.toUpperCase();
    if (region && regionPrefixes[region]) {
      return regionPrefixes[region];
    }

    // STEP 2: fallback con IP geolocation (gratuito)
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      const countryCode = data.country_code?.toUpperCase();
      if (countryCode && regionPrefixes[countryCode]) {
        return regionPrefixes[countryCode];
      }
    } catch (err) {
      console.warn('Impossibile ottenere geolocalizzazione via IP:', err);
    }

    return '+39'; // Default: Italia
  }

  async ngOnInit(): Promise<void> {
    this.loginForm.prefixPhone = await this.getPhonePrefix();
  }

  onSubmitPin(f: NgForm): void {
    try {
      this.isLoading = true;
      let pin = this.pin;

      this.userService
        .validateMail({ email: this.loginForm.email, pin })
        .subscribe({
          next: (response: any) => {
            const md5Password = CryptoJS.MD5(
              this.loginForm.password
            ).toString();

            this.authService
              .login(this.loginForm.email, md5Password, false)
              .subscribe({
                next: (response: any) => {
                  this.isLoading = false;
                  this.loginForm = {
                    email: '',
                    password: '',
                    name: '',
                    repeatEmail: '',
                    repeatPassword: '',
                    phoneNumber: '',
                    prefixPhone: '',
                  };
                },
              });

            this.registerSuccess.emit();
          },
          error: (e: any) => {
            this.isLoading = false;
            console.error(e);
            //'Credenziali non valide. Riprova.'
            this.loginError = e.message;
          },
        });
    } catch (e: any) {
      this.isLoading = false;
      console.error(e);
      this.loginError = 'Errore durante la navigazione. Riprova.';
    }
  }
  emitEvent() {
    this.registerSuccess.emit();
  }

  onSubmit(f: NgForm): void {
    try {
      if (!f.valid) {
        return;
      }

      if (this.loginForm.password !== this.loginForm.repeatPassword) {
        this.loginError = this.lngService.traslate('str_password_not_match');
        return;
      }
      if (this.loginForm.email !== this.loginForm.repeatEmail) {
        this.loginError = this.lngService.traslate('str_email_not_match');
        return;
      }
      if (this.loginForm.password.trim().length < 6) {
        console.log('password mancante');
        return;
      }
      if (this.loginForm.email.trim() == '') {
        console.log('email mancante');
        return;
      }
      if (this.loginForm.prefixPhone.trim() == '') {
        console.log('prefixPhone mancante');
        this.loginError = this.lngService.traslate('str_prefix_is_required');
        return;
      }

      if (
        isNaN(Number(this.loginForm.phoneNumber.trim())) ||
        this.loginForm.phoneNumber.trim() == ''
      ) {
        console.log('Numero di telefono mancante');
        this.loginError = this.lngService.traslate(
          'str_phone_number_is_required'
        );
        return;
      }

      this.isLoading = true;

      const md5Password = CryptoJS.MD5(this.loginForm.password).toString();

      this.userService
        .register({
          email: this.loginForm.email.trim(),
          password: md5Password.trim(),
          name: this.loginForm.name.trim(),
          phoneNumber:
            this.loginForm.prefixPhone + this.loginForm.phoneNumber.trim(),
          lng: this.lngService.getLng(),
        })
        .subscribe({
          next: (response: any) => {
            this.isLoading = false;
            this.loginError = '';
            this.pin = '';
            this.pinMode = true;
          },
          error: (e: any) => {
            this.isLoading = false;
            console.error(e);
            //'Credenziali non valide. Riprova.'
            this.loginError = e.error.message || e.message;
          },
        });
    } catch (e: any) {
      this.isLoading = false;
      console.error(e);
      this.loginError = 'Errore durante la navigazione. Riprova.';
    }
  }
}
