import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { fadeAnimation } from '../../animations/fade.animation';
@Component({
  selector: 'app-impostazioni',
  imports: [TitlePageComponent, RouterModule],
  animations: [fadeAnimation],
  templateUrl: './impostazioni.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './impostazioni.component.scss',
})
export class ImpostazioniComponent {}
