import { Component } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';
@Component({
  selector: 'app-lowbar',
  imports: [RouterModule],
  templateUrl: './lowbar.component.html',
  styleUrl: './lowbar.component.scss',
})
export class LowbarComponent {}
