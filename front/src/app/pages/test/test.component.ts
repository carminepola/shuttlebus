import { Component } from '@angular/core';
import { LoginFormComponent } from '../../components/login-form/login-form.component';
import { RegistrazioneComponent } from '../../components/registrazione/registrazione.component';

@Component({
  selector: 'app-test',
  imports: [LoginFormComponent, RegistrazioneComponent],
  templateUrl: './test.component.html',
  styleUrl: './test.component.scss',
})
export class TestComponent {}
