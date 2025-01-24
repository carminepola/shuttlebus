import { Component } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
@Component({
  selector: 'app-route',
  imports: [TitlePageComponent, RouterModule],
  templateUrl: './route.component.html',
  styleUrl: './route.component.scss',
})
export class RouteComponent {}
