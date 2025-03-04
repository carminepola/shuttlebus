import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import * as CryptoJS from 'crypto-js';
import { LoginFormComponent } from '../login-form/login-form.component';
import { RegistrazioneComponent } from '../registrazione/registrazione.component';

declare var bootstrap: any;
@Component({
  selector: 'app-navbar',

  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    LoginFormComponent,
    RegistrazioneComponent,
  ],
})
export class NavbarComponent {
  constructor(private router: Router, private authService: AuthService) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.removeModalBackdrop();
      }
    });
  }
  private removeModalBackdrop() {
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.remove();
      document.body.classList.remove('modal-open'); // Rimuove la classe che impedisce lo scrolling
      document.body.style.overflow = ''; // Ripristina lo scrolling
    }
  }
  public login: boolean = true;
  onTicket() {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/admin/home']);
    } else {
      const myModal = new bootstrap.Modal('#modalLogin');
      const modalToggle: HTMLElement | null =
        document.getElementById('modalLogin');
      if (modalToggle != null) {
        myModal.show(modalToggle);
      }
    }
  }
}
