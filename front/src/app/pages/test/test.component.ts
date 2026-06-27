import { Component, ChangeDetectionStrategy } from '@angular/core';
import { LoginFormComponent } from '../../components/login-form/login-form.component';
import { RegistrazioneComponent } from '../../components/registrazione/registrazione.component';

@Component({
  selector: 'app-test',
  imports: [RegistrazioneComponent],
  templateUrl: './test.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './test.component.scss',
})
export class TestComponent {}
