import { Component } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';
@Component({
  selector: 'app-lowBar',
  imports: [RouterModule],
  templateUrl: './lowBar.component.html',
  styleUrl: './lowBar.component.scss',
})
export class LowBarComponent {}
