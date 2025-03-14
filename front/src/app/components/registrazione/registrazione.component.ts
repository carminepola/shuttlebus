import { Component, OnInit, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { UserService } from '../../services/user/user.service';
import * as CryptoJS from 'crypto-js';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { LngService } from '../../services/lng/lng.service';
import { matchValues } from '../../pipe/matchValidator';
@Component({
  selector: 'app-registrazione',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslatePipe],
  templateUrl: './registrazione.component.html',
  styleUrl: './registrazione.component.scss',
})
export class RegistrazioneComponent implements OnInit {
  loginForm!: FormGroup;
  pinForm: FormGroup;
  isSubmitted = false;
  loginError = '';
  isLoading = false;
  privacy = false;
  pinMode = false;
  @Output() registerSuccess = new EventEmitter<void>();
  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private userService: UserService,
    private lngService: LngService
  ) {
    this.pinForm = this.formBuilder.group({
      pin: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/admin/home']);
    }
    this.loginForm = this.formBuilder.group({
      name: ['', [Validators.required]],

      email: ['', [Validators.required, Validators.email]],
      repeatEmail: [
        '',
        [Validators.required, Validators.email, matchValues('email')],
      ],
      prefixPhone: ['', []],
      phoneNumber: ['', [Validators.minLength(10)]],
      repeatPassword: [
        '',
        [Validators.required, Validators.minLength(6), matchValues('password')],
      ],
      password: ['', [Validators.required, Validators.minLength(6)]],
      termsAndConditions: ['', [Validators.required]],
    });
  }

  get pinFormControls() {
    return this.pinForm.controls;
  }
  get formControls() {
    return this.loginForm.controls;
  }

  onSubmitPin(event: Event): void {
    try {
      event.preventDefault();
      event.stopPropagation();

      this.isSubmitted = true;

      if (this.pinForm.invalid) {
        return;
      }

      this.isLoading = true;

      const { pin } = this.pinForm.value;

      this.userService
        .validateMail({ email: this.loginForm.value.email, pin })
        .subscribe({
          next: (response: any) => {
            const { email, password, name, phoneNumber, prefixPhone } =
              this.loginForm.value;
            const md5Password = CryptoJS.MD5(password).toString();

            this.authService.login(email, md5Password, false).subscribe({
              next: (response: any) => {
                this.isLoading = false;
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
  onSubmit(event: Event): void {
    try {
      event.preventDefault();
      event.stopPropagation();

      this.isSubmitted = true;

      if (this.loginForm.invalid) {
        return;
      }

      this.isLoading = true;

      const { email, password, name, phoneNumber, prefixPhone } =
        this.loginForm.value;
      const md5Password = CryptoJS.MD5(password).toString();

      this.userService
        .register({
          email,
          password: md5Password,
          name,
          phoneNumber: prefixPhone + phoneNumber,
          lng: this.lngService.getLng(),
        })
        .subscribe({
          next: (response: any) => {
            this.isLoading = false;

            this.pinForm = this.formBuilder.group({
              pin: ['', [Validators.required, Validators.minLength(6)]],
            });
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
