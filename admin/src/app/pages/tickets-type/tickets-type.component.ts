import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { Router, RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { FormsModule, ReactiveFormsModule, NgForm } from '@angular/forms';

import { FilterPipe } from '../../pipe/filter.pipe';
import { TicketTypeService } from '../../services/ticket-type/ticket-type.service';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
@Component({
  selector: 'app-ticketsType',
  imports: [
    TitlePageComponent,
    RouterModule,
    CommonModule,
    LoadingComponent,
    FormsModule,
    FilterPipe,
  ],
  templateUrl: './tickets-type.component.html',
  styleUrl: './tickets-type.component.scss',
})
export class TicketsTypeComponent implements OnInit {
  public loading: boolean = true;
  public ticketsType: any[] = [];
  public search: string = '';
  constructor(
    private ticketTypeService: TicketTypeService,
    private router: Router
  ) {}
  ngOnInit(): void {
    this.readAll();
  }

  readAll() {
    debugger;
    this.loading = true;
    this.ticketTypeService.getAllTicketTypes().subscribe((res) => {
      if (res && res.ticketType) {
        this.loading = false;
        debugger;
        this.ticketsType = res.ticketType;
      }
    });
  }
  edit(id: string) {
    this.router.navigate([`admin/ticket-details/${id}`]);
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
    }).then((result: any) => {
      /* Read more about isConfirmed, isDenied below */
      if (result.isConfirmed) {
        this.deleteTicketTypeFromId(id);
      } else if (result.isDenied) {
      }
    });
  }
  deleteTicketTypeFromId(id: string) {
    this.loading = true;
    this.ticketTypeService.deleteTicketType(id).subscribe((res) => {
      this.loading = false;
      this.readAll();
    });
  }
}
