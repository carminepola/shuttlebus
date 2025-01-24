import { Component } from '@angular/core';
import { fadeAnimation } from '../../animations/fade.animation';
import { FooterComponent } from '../../components/footer/footer.component';

@Component({
  selector: 'app-homepage',
  imports: [FooterComponent],
  animations: [fadeAnimation],
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.scss',
})
export class HomepageComponent {}
