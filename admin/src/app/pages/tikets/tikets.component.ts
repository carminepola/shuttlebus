import { Component } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { Route, RouterModule } from '@angular/router';
@Component({
  selector: 'app-tikets',
  imports: [TitlePageComponent, RouterModule],
  templateUrl: './tikets.component.html',
  styleUrl: './tikets.component.scss',
})
export class TiketsComponent {}
