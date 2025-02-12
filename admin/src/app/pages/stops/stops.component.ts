import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { RouterModule, Router } from '@angular/router';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { StopsService } from '../../services/stops/stops.service';
import { FormsModule } from '@angular/forms';
import { FilterPipe } from '../../pipe/filter.pipe';
import Swal from 'sweetalert2';
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

  constructor(private stopService: StopsService, private router: Router) {}
  ngOnInit(): void {
    this.readAll();
  }
  readAll() {
    this.loading = true;
    this.stopService.getAllStops().subscribe((res) => {
      this.loading = false;
      if (res && res.stops) {
        this.stops = res.stops.map((stop: any) => {
          return {
            id: stop.id,
            name: stop.name,
            description: stop.description.it,
            latitude: stop.location.latitude,
            longitude: stop.location.longitude,
            address: stop.address,
          };
        });
      }
    });
  }
  deleteStopFromId(id: string) {
    this.loading = true;
    this.stopService.deleteStop(id).subscribe((res) => {
      this.loading = false;
      this.readAll();
    });
  }

  edit(id: string) {
    this.router.navigate([`admin/fermata/${id}`]);
  }
  delete(id: string) {
    Swal.fire({
      title: 'Vuoi cancellare la fermata?',
      showDenyButton: true,
      position: 'top',
      icon: 'warning',
      showClass: {
        popup: `
      animate__animated
      animate__slideInDown   
      animate__faster
    `,
      },
      hideClass: {
        popup: `
      animate__animated
      animate__slideOutUp
      animate__faster
    `,
      },
      customClass: {
        confirmButton: 'btn btn-primary btn-lg mr-2',
        denyButton: 'btn btn-danger btn-lg',
        popup: 'rounded-4',
      },

      showCancelButton: false,
      confirmButtonText: 'Confermo',
      denyButtonText: `Annulla`,
    }).then((result) => {
      /* Read more about isConfirmed, isDenied below */
      if (result.isConfirmed) {
        this.deleteStopFromId(id);
      } else if (result.isDenied) {
      }
    });
  }
}
