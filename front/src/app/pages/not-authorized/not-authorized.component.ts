import { Component } from '@angular/core';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-not-authorized',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './not-authorized.component.html',
  styleUrl: './not-authorized.component.scss',
})
export class NotAuthorizedComponent {}
