import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { Router, ActivatedRoute } from '@angular/router';
import { GoogleAuthService } from '../../services/google-auth/google-auth.service';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-auth-page',
  imports: [LoadingComponent],
  templateUrl: './auth-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './auth-page.component.scss',
})
export class AuthPageComponent implements OnInit {
  public id: string = '';
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private googleAuth: GoogleAuthService,
    private authService: AuthService
  ) {}
  async ngOnInit(): Promise<void> {
    this.route.params.subscribe((params: any) => {
      this.id = params['id'];
    });

    this.googleAuth.getSession(this.id).subscribe({
      next: (response: any) => {
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
      },
      error: (e: any) => {
        this.router.navigateByUrl('/');
      },
    });
  }
}
