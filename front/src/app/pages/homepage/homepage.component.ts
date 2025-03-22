import { Component, OnInit } from '@angular/core';
import { fadeAnimation } from '../../animations/fade.animation';
import { FooterComponent } from '../../components/footer/footer.component';
import { LngService } from '../../services/lng/lng.service';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { MapsOfPointsComponent } from '../../components/maps-of-points/maps-of-points.component';
import { FormsModule } from '@angular/forms';
import { SearchComponent } from '../../components/search/search.component';
import { Router, RouterModule } from '@angular/router';
@Component({
  selector: 'app-homepage',
  imports: [
    FooterComponent,
    CommonModule,
    TranslatePipe,
    SearchComponent,
    MapsOfPointsComponent,
    RouterModule,
  ],
  animations: [fadeAnimation],
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.scss',
})
export class HomepageComponent implements OnInit {
  constructor(public router: Router) {}
  ngOnInit(): void {
    if (localStorage.getItem('authUrl')) {
      let url = localStorage.getItem('authUrl');
      if (url) {
        this.router.navigateByUrl(url);
      } else {
        localStorage.removeItem('ticket');
      }
    } else {
      localStorage.removeItem('ticket');
    }
  }
}
