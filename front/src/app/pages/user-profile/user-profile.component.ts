import { Component } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import Swal from 'sweetalert2';
import { CommonModule } from '@angular/common';
import { LngService } from '../../services/lng/lng.service';
import { AuthService } from '../../services/auth/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '../../pipe/translate.pipe';
@Component({
  selector: 'app-user-profile',
  imports: [TitlePageComponent, TranslatePipe, CommonModule],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss',
})
export class UserProfileComponent {
  constructor(
    private lng: LngService,
    private authService: AuthService,
    private router: Router
  ) {}

  goTo(path: string) {
    this.router.navigate([path]);
  }
  getUser() {
    let user = this.authService.getDecodedToken();
    if (user) {
      return user.email;
    }
    return;
  }
  getRole() {
    let user = this.authService.getDecodedToken();
    if (user) {
      debugger;
      return parseInt(user.role);
    }
    return 999;
  }
  logout() {
    Swal.fire({
      title: this.lng.traslate('ste_vuoi_uscire'),
      showDenyButton: true,
      position: 'top',
      icon: 'warning',
      showClass: {
        popup: `
          animate__animated
          animate__slideInDown   
          animate__faster
        `,
      },
      hideClass: {
        popup: `
          animate__animated
          animate__slideOutUp
          animate__faster
        `,
      },
      customClass: {
        confirmButton: 'btn btn-primary btn-lg mr-2',
        denyButton: 'btn btn-danger btn-lg',
        popup: 'rounded-4',
      },

      showCancelButton: false,
      confirmButtonText: this.lng.traslate('str_confermo'),
      denyButtonText: `${this.lng.traslate('str_annulla')}`,
    }).then((result: any) => {
      /* Read more about isConfirmed, isDenied below */
      if (result.isConfirmed) {
        this.authService.logout().subscribe({
          next: (response) => {
            this.authService.deleteCookie('jwt');

            this.router.navigate(['/']);
          },
          error: (error) => {
            this.router.navigate(['/']);

            console.error('Errore durante il logout', error);
          },
        });
      } else if (result.isDenied) {
      }
    });
  }
}
