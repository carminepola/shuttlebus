import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';

import { TranslatePipe } from '../../pipe/translate.pipe';
import { RouterModule, Router } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { fadeAnimation } from '../../animations/fade.animation';
import { LngService } from '../../services/lng/lng.service';
@Component({
  selector: 'app-info',
  imports: [TitlePageComponent, TranslatePipe],
  templateUrl: './info.component.html',
  styleUrl: './info.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeAnimation],
})
export class InfoComponent {
  constructor(private router: Router, private lngService: LngService) {}
  goTo(path: string) {
    this.router.navigate(this.lngService.langPathArray(path));
  }
}
