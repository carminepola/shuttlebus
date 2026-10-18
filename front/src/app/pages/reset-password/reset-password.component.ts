import { ReactiveFormsModule } from '@angular/forms';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { LngService } from '../../services/lng/lng.service';
import { TranslatePipe } from '../../pipe/translate.pipe';

/**
 * Pagina di reset password raggiunta dal link della mail:
 * /reset-password?token=<TOKEN>
 * Il token e' a scadenza (30 min) e monouso (lato server).
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslatePipe],
  templateUrl: './reset-password.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./reset-password.component.scss'],
})
export class ResetPasswordComponent implements OnInit {
  resetForm!: FormGroup;
  token: string = '';
  isLoading: boolean = false;
  loginError: string = '';
  success: boolean = false;
  tokenError: boolean = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private lngService: LngService,
  ) {}

  goBack() {
    window.history.back();
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.tokenError = true;
    }
    this.resetForm = this.formBuilder.group(
      {
        password: ['', [Validators.required, Validators.minLength(8)]],
        passwordConfirm: ['', [Validators.required]],
      },
      { validators: this.passwordsMatchValidator },
    );
  }

  private passwordsMatchValidator(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirm = group.get('passwordConfirm')?.value;
    return password && confirm && password !== confirm ? { passwordsMismatch: true } : null;
  }

  get formControls() {
    return this.resetForm.controls;
  }

  onSubmit(event: Event): void {
    event.stopPropagation();
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }
    this.isLoading = true;
    this.loginError = '';

    const password = this.resetForm.get('password')?.value;
    this.authService.resetPassword(this.token, password).subscribe({
      next: () => {
        this.isLoading = false;
        this.success = true;
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 3000);
      },
      error: (e: any) => {
        this.isLoading = false;
        if (e?.status === 400) {
          this.loginError = this.lngService.traslate('str_reset_token_invalid') || 'Token scaduto o non valido';
        } else {
          this.loginError = this.lngService.traslate('str_login_error') || 'Errore, riprova';
        }
      },
    });
  }
}
