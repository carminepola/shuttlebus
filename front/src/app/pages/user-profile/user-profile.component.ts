import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import Swal from 'sweetalert2';

import { LngService } from '../../services/lng/lng.service';
import { AuthService } from '../../services/auth/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { fadeAnimation } from '../../animations/fade.animation';
@Component({
  selector: 'app-user-profile',
  animations: [fadeAnimation],
  imports: [TitlePageComponent, TranslatePipe, LoadingComponent],
  templateUrl: './user-profile.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './user-profile.component.scss',
})
export class UserProfileComponent implements OnInit {
  constructor(
    private lng: LngService,
    private authService: AuthService,
    private router: Router,
  ) {}

  loading = true;

  ngOnInit(): void {
    setTimeout(() => {
      this.loading = false;
    }, 10);
  }
  goTo(path: string) {
    this.router.navigate([path]);
  }
  getUser(): string {
    let user = this.authService.getDecodedToken();
    if (user) {
      return user.email ?? '';
    }
    return '';
  }
  getRole() {
    let user = this.authService.getDecodedToken();
    if (user) {
      return Number(user.role);
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
        confirmButton: 'btn btn-secondary btn-lg mr-2',
        denyButton: 'btn btn-outline-secondary btn-lg',
        popup: 'rounded-4 glass',
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
