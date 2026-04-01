import { Component, OnInit } from '@angular/core';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-not-authorized',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './not-authorized.component.html',
  styleUrl: './not-authorized.component.scss',
})
export class NotAuthorizedComponent implements OnInit {
  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.getRole();
  }

  getRole() {
    let user = this.authService.getDecodedToken();
    if (user) {
      if (parseInt(user.role) > 9999) {
        return parseInt(user.role);
      }

      this.authService.deleteCookie('jwt');
      this.authService.logout().subscribe();
    }

    return 9999;
  }
}
