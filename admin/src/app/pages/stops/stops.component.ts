import { Component } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { RouterModule, Router } from '@angular/router';
@Component({
  selector: 'app-stops',
  imports: [TitlePageComponent, RouterModule],
  templateUrl: './stops.component.html',
  styleUrl: './stops.component.scss',
})
export class StopsComponent {

}
