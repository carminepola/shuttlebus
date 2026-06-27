import { Component, OnInit, EventEmitter, Output, ElementRef, HostListener, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule, ReactiveFormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { UserService } from '../../services/user/user.service';
import * as CryptoJS from 'crypto-js';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { LngService } from '../../services/lng/lng.service';

const COUNTRIES = [
  { code: 'IT', name: 'Italia', prefix: '+39' },
  { code: 'SM', name: 'San Marino', prefix: '+378' },
  { code: 'VA', name: 'Vatican City', prefix: '+379' },
  { code: 'GB', name: 'United Kingdom', prefix: '+44' },
  { code: 'DE', name: 'Germany', prefix: '+49' },
  { code: 'FR', name: 'France', prefix: '+33' },
  { code: 'ES', name: 'Spain', prefix: '+34' },
  { code: 'PT', name: 'Portugal', prefix: '+351' },
  { code: 'CH', name: 'Switzerland', prefix: '+41' },
  { code: 'AT', name: 'Austria', prefix: '+43' },
  { code: 'BE', name: 'Belgium', prefix: '+32' },
  { code: 'NL', name: 'Netherlands', prefix: '+31' },
  { code: 'LU', name: 'Luxembourg', prefix: '+352' },
  { code: 'MC', name: 'Monaco', prefix: '+377' },
  { code: 'MT', name: 'Malta', prefix: '+356' },
  { code: 'AL', name: 'Albania', prefix: '+355' },
  { code: 'HR', name: 'Croatia', prefix: '+385' },
  { code: 'ME', name: 'Montenegro', prefix: '+382' },
  { code: 'RS', name: 'Serbia', prefix: '+381' },
  { code: 'MK', name: 'North Macedonia', prefix: '+389' },
  { code: 'BA', name: 'Bosnia and Herzegovina', prefix: '+387' },
  { code: 'SI', name: 'Slovenia', prefix: '+386' },
  { code: 'IE', name: 'Ireland', prefix: '+353' },
  { code: 'PL', name: 'Poland', prefix: '+48' },
  { code: 'CZ', name: 'Czech Republic', prefix: '+420' },
  { code: 'SK', name: 'Slovakia', prefix: '+421' },
  { code: 'HU', name: 'Hungary', prefix: '+36' },
  { code: 'RO', name: 'Romania', prefix: '+40' },
  { code: 'BG', name: 'Bulgaria', prefix: '+359' },
  { code: 'GR', name: 'Greece', prefix: '+30' },
  { code: 'SE', name: 'Sweden', prefix: '+46' },
  { code: 'NO', name: 'Norway', prefix: '+47' },
  { code: 'DK', name: 'Denmark', prefix: '+45' },
  { code: 'FI', name: 'Finland', prefix: '+358' },
  { code: 'EE', name: 'Estonia', prefix: '+372' },
  { code: 'LV', name: 'Latvia', prefix: '+371' },
  { code: 'LT', name: 'Lithuania', prefix: '+370' },
  { code: 'BY', name: 'Belarus', prefix: '+375' },
  { code: 'UA', name: 'Ukraine', prefix: '+380' },
  { code: 'RU', name: 'Russia', prefix: '+7' },
  { code: 'TR', name: 'Turkey', prefix: '+90' },
  { code: 'US', name: 'United States', prefix: '+1' },
  { code: 'CA', name: 'Canada', prefix: '+1' },
  { code: 'AU', name: 'Australia', prefix: '+61' },
  { code: 'NZ', name: 'New Zealand', prefix: '+64' },
  { code: 'BR', name: 'Brazil', prefix: '+55' },
  { code: 'MX', name: 'Mexico', prefix: '+52' },
  { code: 'AR', name: 'Argentina', prefix: '+54' },
  { code: 'JP', name: 'Japan', prefix: '+81' },
  { code: 'KR', name: 'South Korea', prefix: '+82' },
  { code: 'CN', name: 'China', prefix: '+86' },
  { code: 'IN', name: 'India', prefix: '+91' },
  { code: 'TW', name: 'Taiwan', prefix: '+886' },
  { code: 'SG', name: 'Singapore', prefix: '+65' },
  { code: 'HK', name: 'Hong Kong', prefix: '+852' },
  { code: 'AE', name: 'United Arab Emirates', prefix: '+971' },
  { code: 'SA', name: 'Saudi Arabia', prefix: '+966' },
  { code: 'QA', name: 'Qatar', prefix: '+974' },
  { code: 'IL', name: 'Israel', prefix: '+972' },
  { code: 'EG', name: 'Egypt', prefix: '+20' },
  { code: 'ZA', name: 'South Africa', prefix: '+27' },
  { code: 'NG', name: 'Nigeria', prefix: '+234' },
  { code: 'KE', name: 'Kenya', prefix: '+254' },
  { code: 'MA', name: 'Morocco', prefix: '+212' },
  { code: 'TN', name: 'Tunisia', prefix: '+216' },
  { code: 'DZ', name: 'Algeria', prefix: '+213' },
  { code: 'TH', name: 'Thailand', prefix: '+66' },
  { code: 'VN', name: 'Vietnam', prefix: '+84' },
  { code: 'PH', name: 'Philippines', prefix: '+63' },
  { code: 'MY', name: 'Malaysia', prefix: '+60' },
  { code: 'ID', name: 'Indonesia', prefix: '+62' },
  { code: 'CO', name: 'Colombia', prefix: '+57' },
  { code: 'CL', name: 'Chile', prefix: '+56' },
  { code: 'PE', name: 'Peru', prefix: '+51' },
];

@Component({
  selector: 'app-registrazione',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslatePipe, FormsModule],
  templateUrl: './registrazione.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './registrazione.component.scss',
})
export class RegistrazioneComponent implements OnInit {
  isSubmitted = false;
  loginError = '';
  isLoading = false;
  privacy = false;
  pinMode = false;
  pin = '';
  showPassword = false;
  termsAccepted = false;
  prefixSearch = '';
  prefixDropdownOpen = false;
  filteredCountries = COUNTRIES;
  selectedCountry: any = null;
  pwdRules = {
    minLength: false,
    hasUpper: false,
    hasLower: false,
    hasNumber: false,
    hasSpecial: false,
  };
  emailRules = {
    hasAt: false,
    hasLocalPart: false,
    hasDomain: false,
    hasTld: false,
    valid: false,
  };
  public loginForm = {
    email: '',
    password: '',
    name: '',
    phoneNumber: '',
    prefixPhone: '',
  };

  @Output() registerSuccess = new EventEmitter<void>();
  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService,
    private lngService: LngService,
    private elementRef: ElementRef,
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.prefixDropdownOpen = false;
    }
  }

  get selectedPrefixLabel(): string {
    if (this.selectedCountry) {
      return this.selectedCountry.prefix;
    }
    if (this.loginForm.prefixPhone) {
      return this.loginForm.prefixPhone;
    }
    return '';
  }

  filterCountries() {
    const q = this.prefixSearch.toLowerCase().trim();
    if (!q) {
      this.filteredCountries = COUNTRIES;
      return;
    }
    this.filteredCountries = COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.prefix.includes(q) ||
      c.code.toLowerCase().includes(q),
    );
  }

  selectCountry(country: any) {
    this.selectedCountry = country;
    this.loginForm.prefixPhone = country.prefix;
    this.prefixDropdownOpen = false;
    this.prefixSearch = '';
  }

  openPrefixDropdown() {
    this.prefixDropdownOpen = true;
    this.prefixSearch = '';
    this.filteredCountries = COUNTRIES;
    setTimeout(() => {
      const input = document.getElementById('prefix-search');
      if (input) input.focus();
    }, 50);
  }

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
    this.selectedCountry = COUNTRIES.find(c => c.prefix === this.loginForm.prefixPhone) || null;
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
              this.loginForm.password,
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
            this.loginError = this.lngService.traslate('str_pin_not_valid');
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

  onPasswordInput(): void {
    const pwd = this.loginForm.password;
    this.pwdRules = {
      minLength: pwd.length >= 6,
      hasUpper: /[A-Z]/.test(pwd),
      hasLower: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
      hasSpecial: /[^A-Za-z0-9]/.test(pwd),
    };
  }

  onEmailInput(): void {
    const email = this.loginForm.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const parts = email.split('@');
    const hasAt = email.includes('@');
    const hasLocalPart = hasAt && parts[0]?.length > 0;
    const domain = hasAt ? parts[1] : '';
    const domainParts = domain.split('.');
    const hasDomain = domain.length > 0 && domainParts[0]?.length > 0;
    const hasTld = domainParts.length >= 2 && domainParts[domainParts.length - 1]?.length >= 2;
    this.emailRules = {
      hasAt,
      hasLocalPart,
      hasDomain,
      hasTld,
      valid: emailRegex.test(email),
    };
  }

  passwordStrengthPercent(): number {
    const met = Object.values(this.pwdRules).filter(Boolean).length;
    return (met / 5) * 100;
  }

  passwordStrengthClass(): string {
    const met = Object.values(this.pwdRules).filter(Boolean).length;
    if (met <= 1) return 'strength-weak';
    if (met <= 3) return 'strength-medium';
    return 'strength-strong';
  }

  passwordStrengthLabel(): string {
    const met = Object.values(this.pwdRules).filter(Boolean).length;
    if (met <= 1) return this.lngService.traslate('str_pwd_strength_weak') || 'Debole';
    if (met <= 3) return this.lngService.traslate('str_pwd_strength_medium') || 'Media';
    return this.lngService.traslate('str_pwd_strength_strong') || 'Forte';
  }

  isPasswordValid(): boolean {
    return Object.values(this.pwdRules).every(Boolean);
  }

  onPhoneInput(event: any): void {
    // Get the current input value
    let value = event.target.value;

    // Remove all non-numeric characters and spaces
    value = value.replace(/[^0-9]/g, '');

    // Update the model with the cleaned value
    this.loginForm.phoneNumber = value;

    // Update the input field value
    event.target.value = value;
  }

  onSubmit(f: NgForm): void {
    try {
      this.isSubmitted = true;
      if (!this.loginForm.name.trim() || !this.loginForm.email.trim() || !this.loginForm.password.trim() || !this.loginForm.phoneNumber.trim() || !this.termsAccepted) {
        this.loginError = this.lngService.traslate('str_complete_all_fields_and_terms');
        return;
      }
      if (!this.emailRules.valid) {
        this.loginError = this.lngService.traslate('str_email_invalid_format') || 'Formato email non valido';
        return;
      }

      if (!this.isPasswordValid()) {
        this.loginError = this.lngService.traslate('str_password_requirements_not_met') || 'La password non soddisfa i requisiti minimi';
        return;
      }
      if (!this.termsAccepted) {
        this.loginError = this.lngService.traslate('str_terms_required') || 'Devi accettare i termini e le condizioni';
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
          'str_phone_number_is_required',
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
