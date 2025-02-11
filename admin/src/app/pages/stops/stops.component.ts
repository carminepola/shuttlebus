import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { RouterModule, Router } from '@angular/router';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { StopsService } from '../../services/stops/stops.service';
import { FormsModule } from '@angular/forms';
import { FilterPipe } from '../../pipe/filter.pipe';
@Component({
  selector: 'app-stops',
  imports: [
    TitlePageComponent,
    RouterModule,
    CommonModule,
    LoadingComponent,
    FormsModule,
    FilterPipe,
  ],
  templateUrl: './stops.component.html',
  styleUrl: './stops.component.scss',
})
export class StopsComponent implements OnInit {
  public loading: boolean = true;
  public stops: any[] = [];
  public search: string = '';
  constructor(private stopService: StopsService) {}
  ngOnInit(): void {
    this.stopService.getAllStops().subscribe((res) => {
      this.loading = false;
      if (res && res.stops) {
        this.stops = res.stops;
      }
    });
  }
}
