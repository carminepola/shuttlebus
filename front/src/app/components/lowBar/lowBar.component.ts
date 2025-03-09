import { Component } from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';
import { AuthService } from '../../services/auth/auth.service';
import { CommonModule } from '@angular/common';
import { LoginFormComponent } from '../login-form/login-form.component';
import { RegistrazioneComponent } from '../registrazione/registrazione.component';
import { ModalService } from '../../services/modal/modal.service';

declare var bootstrap: any;
@Component({
  selector: 'app-lowBar',
  imports: [
    RouterModule,
    CommonModule,
    LoginFormComponent,
    RegistrazioneComponent,
  ],
  templateUrl: './lowBar.component.html',
  styleUrl: './lowBar.component.scss',
})
export class LowBarComponent {
  myModal: any;
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

  login: boolean = true;
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
      this.modalService.openModal('modalLogin2');
    }
  }
}
