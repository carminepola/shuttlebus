import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipe/translate.pipe';

@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterLink, TranslatePipe],
})
export class NotFoundComponent {}
