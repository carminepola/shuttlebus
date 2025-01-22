import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { fadeAnimation } from '../../animations/fade.animation';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { ReactiveFormsModule } from '@angular/forms';
import { ThemeToggleComponent } from '../../components/theme-toggle/theme-toggle.component';
@Component({
  selector: 'app-user-settings',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TitlePageComponent,
    ThemeToggleComponent,
  ],
  templateUrl: './user-settings.component.html',
  styleUrl: './user-settings.component.scss',
  animations: [fadeAnimation],
  standalone: true,
})
export class UserSettingsComponent implements OnInit {
  constructor() {}
  ngOnInit() {}
}
