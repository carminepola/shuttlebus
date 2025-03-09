import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { UserService } from '../../services/user/user.service';
import { lastValueFrom } from 'rxjs';
import { fadeAnimation } from '../../animations/fade.animation';

@Component({
  selector: 'app-users',
  imports: [TitlePageComponent, RouterModule, TitlePageComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent {
  constructor(private router: Router, private userService: UserService) {}
}
