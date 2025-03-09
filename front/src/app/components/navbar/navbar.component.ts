import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { ModalService } from '../../services/modal/modal.service';
import { CommonModule } from '@angular/common';

import { LoginFormComponent } from '../login-form/login-form.component';
import { RegistrazioneComponent } from '../registrazione/registrazione.component';
@Component({
  selector: 'app-navbar',
  imports: [CommonModule, LoginFormComponent, RegistrazioneComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  standalone: true,
})
export class NavbarComponent {
  constructor(
    private router: Router,
    private authService: AuthService,
    private modalService: ModalService
  ) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.modalService.closeModal();
      }
    });
  }

  public login: boolean = true;

  getPath(): string {
    return this.router.url;
  }

  onEvent() {
    this.modalService.closeModal();
  }
  onComplete() {
    this.login = true;

    let page = localStorage.getItem('authUrl');
    if (page) {
      localStorage.removeItem('authUrl');
      this.router.navigateByUrl(page);
    } else {
      let session = this.authService.getDecodedToken();

      if (session.role <= 50) {
        this.router.navigateByUrl('/admin/home');
      } else {
        this.router.navigateByUrl('/user/account');
      }
    }
  }

  onTicket() {
    if (this.authService.isLoggedIn()) {
      let session = this.authService.getDecodedToken();
      if (session.role <= 50) {
        this.router.navigate(['/admin/home']);
      } else {
        this.router.navigate(['/user/account']);
      }
    } else {
      this.modalService.openModal('modalLogin');
    }
  }
}
