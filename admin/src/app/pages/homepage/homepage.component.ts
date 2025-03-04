import { Component, OnInit } from '@angular/core';
import { fadeAnimation } from '../../animations/fade.animation';
import { FooterComponent } from '../../components/footer/footer.component';
import { LngService } from '../../services/lng/lng.service';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../pipe/translate.pipe';

import { FormsModule } from '@angular/forms';
import { SearchComponent } from '../../components/search/search.component';
@Component({
  selector: 'app-homepage',
  imports: [FooterComponent, CommonModule, TranslatePipe, SearchComponent],
  animations: [fadeAnimation],
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.scss',
})
export class HomepageComponent {}
