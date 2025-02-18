import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { FormsModule, ReactiveFormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { ActivatedRoute, Router } from '@angular/router';
import { StopsService } from '../../services/stops/stops.service';
@Component({
  selector: 'app-stop-details',
  imports: [CommonModule, TitlePageComponent, FormsModule, LoadingComponent, ReactiveFormsModule],
  templateUrl: './stop-details.component.html',
  styleUrl: './stop-details.component.scss'
})
export class StopDetailsComponent implements OnInit {
  constructor(private route: ActivatedRoute, private router: Router, private cdr: ChangeDetectorRef, private stopService: StopsService) { }
  id: string = '';
  form: any;
  loading: boolean = true;
  stopForm: any = { name: "", address: "", isActive: true, description: { it: "", en: "" }, location: { latitude: "", longitude: "" } };
  errorMessage: string = "";
  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.id = params["id"];
      if (this.id) {
        this.load(this.id)
      }
      else {
        this.loading = false;
      }

    });


  }
  onSubmit(form: NgForm) {

    if (form.valid) {
      this.loading = true;

      if (!this.id) {
        this.stopService.createStop(this.stopForm).subscribe({
          next: (response: any) => {
            this.loading = false;
            this.router.navigate(['admin/fermate/']);


          },
          error: (e: any) => {

            this.loading = false;

            if (e.message) {
              this.errorMessage = e.message;
            }

            if (e.error.message) {
              this.errorMessage = e.error.message;
            }
          },
        });
      }
      else {
        this.stopService.updateStop(this.stopForm).subscribe({
          next: (response: any) => {

            this.loading = false;
            this.router.navigate(['admin/fermate/']);
          },
          error: (e: any) => {

            this.loading = false;

            if (e.message) {
              this.errorMessage = e.message;
            }

            if (e.error.message) {
              this.errorMessage = e.error.message;
            }
          },
        });
      }

    }
  }
  onImageChange(event: any) { }
  load(id: string) {
    this.stopService.getStop(id).subscribe((res) => {
      this.loading = false;
      if (res && res.stop) {


        this.stopForm = res.stop
        this.cdr.detectChanges();

      }
    });
  }

}
