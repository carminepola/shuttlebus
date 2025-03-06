import { Component } from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';
import { AuthService } from '../../services/auth/auth.service';
import { CommonModule } from '@angular/common';
import { LoginFormComponent } from '../login-form/login-form.component';
import { RegistrazioneComponent } from '../registrazione/registrazione.component';
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
  login: boolean = true;
  getPath(): string {
    return this.router.url;
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
      const myModal = new bootstrap.Modal('#modalLogin2');
      const modalToggle: HTMLElement | null =
        document.getElementById('modalLogin2');
      if (modalToggle != null) {
        myModal.show(modalToggle);
      }
    }
  }
}
