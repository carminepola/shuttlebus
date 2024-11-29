import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeAnimation } from '../../animations/fade.animation';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';

@Component({
  selector: 'app-user-settings',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-settings.component.html',
  styleUrl: './user-settings.component.scss',
  animations: [fadeAnimation],
  standalone: true
})
export class UserSettingsComponent {
  isEdit: boolean = false
  fermataForm: FormGroup;
  fermataId: number | null = null;
  loading = false;
  error: string | null = null;
  submitted = false;
  province = [
    { code: 'MI', name: 'Milano' },
    { code: 'RM', name: 'Roma' },
    { code: 'NA', name: 'Napoli' },
    { code: 'TO', name: 'Torino' },
    { code: 'FI', name: 'Firenze' },
    { code: 'BO', name: 'Bologna' },
    { code: 'VE', name: 'Venezia' },
    { code: 'PA', name: 'Palermo' },
    { code: 'GE', name: 'Genova' },
    { code: 'BA', name: 'Bari' },
  ];

  constructor(
    private fb: FormBuilder,

  ) {
    this.fermataForm = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(3)]],
      indirizzo: ['', [Validators.required, Validators.minLength(5)]],
      citta: ['', [Validators.required, Validators.minLength(2)]],
      provincia: ['', [Validators.required]],
      latitudine: [null, [Validators.min(-90), Validators.max(90)]],
      longitudine: [null, [Validators.min(-180), Validators.max(180)]],
      attiva: [true],
      note: [''],
    });
  }
  isFieldInvalid(fieldName: string): boolean {
    const field = this.fermataForm.get(fieldName);
    return (
      !!field &&
      field.invalid &&
      (field.dirty || field.touched || this.submitted)
    );
  }
  onSubmit() {
    this.submitted = true;
    if (this.fermataForm.invalid) {
      return;
    }
  }
  goBack() {
    window.history.back();
  }
  getErrorMessage(fieldName: string): string {
    const field = this.fermataForm.get(fieldName);
    if (!field) return '';

    if (field.hasError('required')) {
      return 'Questo campo è obbligatorio';
    }
    if (field.hasError('minlength')) {
      const minLength = field.errors?.['minlength'].requiredLength;
      return `Minimo ${minLength} caratteri richiesti`;
    }
    if (field.hasError('min')) {
      return `Valore minimo: ${field.errors?.['min'].min}`;
    }
    if (field.hasError('max')) {
      return `Valore massimo: ${field.errors?.['max'].max}`;
    }
    return 'Campo non valido';
  }
}
