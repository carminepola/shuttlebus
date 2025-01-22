import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import {

  FormGroup,
  FormControl,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { ActivatedRoute } from '@angular/router';
@Component({
  selector: 'app-stop-details',
  imports: [TitlePageComponent, ReactiveFormsModule],
  templateUrl: './stop-details.component.html',
  styleUrl: './stop-details.component.scss'
})
export class StopDetailsComponent implements OnInit {
  constructor(private route: ActivatedRoute, private cdr: ChangeDetectorRef) { }
  id: string = '';
  form: any;
  stopForm = new FormGroup({
    name_it: new FormControl('', Validators.required),
    name_en: new FormControl('', Validators.required),
    desc_it: new FormControl('', Validators.required),
    desc_en: new FormControl('', Validators.required),
    lat: new FormControl('', Validators.required),
    lon: new FormControl('', Validators.required),
    img: new FormControl('', Validators.required),
  });

  ngOnInit(): void {


    this.route.params.subscribe(params => {
      this.id = params["id"];
    });


  }
  onSubmit() {

  }
  onImageChange(event: any) { }

}
