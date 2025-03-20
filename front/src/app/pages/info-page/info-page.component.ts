import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { FormsModule, ReactiveFormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FooterComponent } from '../../components/footer/footer.component';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeAnimation } from '../../animations/fade.animation';
import { LngService } from '../../services/lng/lng.service';
@Component({
  selector: 'app-info-page',
  imports: [
    CommonModule,
    TitlePageComponent,
    FormsModule,
    ReactiveFormsModule,
    FooterComponent,
  ],
  templateUrl: './info-page.component.html',
  animations: [fadeAnimation],
  styleUrl: './info-page.component.scss',
})
export class InfoPageComponent {
  public id: string = '';
  public content: string = '';
  public title: string = '';
  public subTitle: string = '';
  constructor(private route: ActivatedRoute, private lng: LngService) {}
  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.id = params['id'] || '';
      this.content = this.lng.traslate('str_' + this.id + '_content');
      this.subTitle = this.lng.traslate('str_' + this.id + '_subtitle');
      this.title = this.lng.traslate('str_' + this.id + '_title');
    });
  }
}
