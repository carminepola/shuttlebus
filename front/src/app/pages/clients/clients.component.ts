import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { UserService } from '../../services/user/user.service';
import { lastValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { fadeAnimation } from '../../animations/fade.animation';
import { FilterPipe } from '../../pipe/filter.pipe';
import { FormsModule, ReactiveFormsModule, NgForm } from '@angular/forms';
@Component({
  selector: 'app-clients',
  imports: [
    TitlePageComponent,
    RouterModule,
    CommonModule,
    LoadingComponent,
    FilterPipe,
    FormsModule,
  ],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss',
  animations: [fadeAnimation],
})
export class ClientsComponent implements OnInit {
  search: string = '';
  loading: boolean = true;
  clients: any = [];
  constructor(private router: Router, private userService: UserService) {}
  async ngOnInit(): Promise<void> {
    try {
      debugger;
      let r = await lastValueFrom(this.userService.getNormalUser());
      this.clients = r.listUser;
    } catch (error) {
      console.error(error);
    }
    this.loading = false;
  }
}
