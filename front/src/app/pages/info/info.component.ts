import { Component } from '@angular/core';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';

import { TranslatePipe } from '../../pipe/translate.pipe';
import { RouterModule } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { fadeAnimation } from '../../animations/fade.animation';
@Component({
  selector: 'app-info',
  imports: [TitlePageComponent, TranslatePipe],
  templateUrl: './info.component.html',
  styleUrl: './info.component.scss',
  animations: [fadeAnimation],
})
export class InfoComponent {
  goTo(path: string) {
    window.location.href = path;
  }
}
