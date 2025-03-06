import { Component, OnInit } from '@angular/core';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { Router, ActivatedRoute } from '@angular/router';
import { googleAuthService } from '../../services/google-auth/google-auth.service';
@Component({
  selector: 'app-auth-page',
  imports: [LoadingComponent],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.scss',
})
export class AuthPageComponent implements OnInit {
  public id: string = '';
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private googleAuth: googleAuthService
  ) {}
  async ngOnInit(): Promise<void> {
    debugger;
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
          this.router.navigateByUrl('/');
        }
      },
      error: (e: any) => {
        this.router.navigateByUrl('/');
      },
    });
  }
}
