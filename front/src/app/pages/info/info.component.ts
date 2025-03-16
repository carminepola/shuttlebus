import { Component } from '@angular/core';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { RouterModule } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
@Component({
  selector: 'app-info',
  imports: [TitlePageComponent, TranslatePipe],
  templateUrl: './info.component.html',
  styleUrl: './info.component.scss',
})
export class InfoComponent {
  goTo(path: string) {
    window.location.href = path;
  }
}
