import { Component, OnInit } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { Route } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StopsService } from '../../services/stops/stops.service';
import { BookingsService } from '../../services/bookings/bookings.service';
import { RoutesService } from '../../services/routes/routes.service';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { lastValueFrom } from 'rxjs';
import { TicketTypeService } from '../../services/ticket-type/ticket-type.service';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';
import { UserService } from '../../services/user/user.service';
import { fadeAnimation } from '../../animations/fade.animation';
import { StripeService } from '../../services/stripe/stripe.service';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { FilterPipe } from '../../pipe/filter.pipe';
import Swal from 'sweetalert2';
@Component({
  selector: 'app-reservation',
  imports: [
    TitlePageComponent,
    TranslatePipe,
    LoadingComponent,
    CommonModule,
    TranslateNamePipe,
    FilterPipe,
    FormsModule,
  ],
  animations: [fadeAnimation],
  templateUrl: './reservation.component.html',
  styleUrl: './reservation.component.scss',
})
export class ReservationComponent implements OnInit {
  public loading: boolean = true;

  public booking: any = [];
  public ticketTypes: any[] = [];
  public routes: any[] = [];
  public stops: any[] = [];
  public search: string = '';
  public filter: any = {
    date: new Date().toISOString().split('T')[0],
    routeId: '',
    scheduleId: '',
    show: 'confirmed',
  };
  public filterSchedule: any = [];

  constructor(
    public stopsService: StopsService,
    public routesService: RoutesService,
    public bookingsService: BookingsService,
    public ticketTypeService: TicketTypeService,
    public stripeService: StripeService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading = true;

    let risTicketTypes = await lastValueFrom(
      this.ticketTypeService.getAllActiveTicketTypes(),
    );
    let routes = await lastValueFrom(this.routesService.getRoutes());
    this.routes = routes.routes || [];
    this.stops = await lastValueFrom(this.stopsService.getAllActiveStops());

    this.filterButton();
  }
  rimborsa(numberOfTickets: number, ticket: any[], bagagli: number) {
    const LUGGAGE_PRICE = 2;

    let ticketRows = '';
    for (const t of ticket) {
      if (t.count > 0) {
        ticketRows += `
          <div class="d-flex align-items-center justify-content-between mb-2 px-2">
            <div class="text-start">
              <div class="fw-bold" style="font-size:0.85rem">${t.name.it || t.name?.en || 'Biglietto'}</div>
              <div class="text-secondary" style="font-size:0.75rem">${t.cost}€ x ${t.count}</div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <button type="button" class="btn btn-outline-secondary btn-sm px-2" onclick="document.getElementById('swal-t-${t.id}').stepDown(); window.swalUpdateTotal()">−</button>
              <input id="swal-t-${t.id}" type="number" class="form-control form-control-sm text-center" 
                style="width:55px" min="0" max="${t.count}" step="1" value="0" 
                data-cost="${t.cost}" data-ticket-id="${t.id}" 
                onchange="window.swalUpdateTotal()" />
              <button type="button" class="btn btn-outline-secondary btn-sm px-2" onclick="document.getElementById('swal-t-${t.id}').stepUp(); window.swalUpdateTotal()">+</button>
            </div>
          </div>`;
      }
    }

    if (bagagli > 0) {
      ticketRows += `
        <div class="d-flex align-items-center justify-content-between mb-2 px-2 border-top pt-2">
          <div class="text-start">
            <div class="fw-bold" style="font-size:0.85rem">Bagagli extra</div>
            <div class="text-secondary" style="font-size:0.75rem">${LUGGAGE_PRICE}€ x ${bagagli}</div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm px-2" onclick="document.getElementById('swal-luggage').stepDown(); window.swalUpdateTotal()">−</button>
            <input id="swal-luggage" type="number" class="form-control form-control-sm text-center" 
              style="width:55px" min="0" max="${bagagli}" step="1" value="0" 
              data-cost="${LUGGAGE_PRICE}" data-ticket-id="__luggage__"
              onchange="window.swalUpdateTotal()" />
            <button type="button" class="btn btn-outline-secondary btn-sm px-2" onclick="document.getElementById('swal-luggage').stepUp(); window.swalUpdateTotal()">+</button>
          </div>
        </div>`;
    }

    Swal.fire({
      title: 'Rimborsa biglietto',
      html: `
        <div class="text-start">
          ${ticketRows}
          <hr class="my-2">
          <div class="d-flex justify-content-between px-2 mb-2">
            <span class="fw-bold">Totale rimborso:</span>
            <span id="swal-refund-total" class="fw-bold text-primary">0.00€</span>
          </div>
        </div>
      `,
      position: 'top',
      icon: 'warning',
      showDenyButton: true,
      showCancelButton: false,
      showClass: {
        popup: `animate__animated animate__slideInDown animate__faster`,
      },
      hideClass: {
        popup: `animate__animated animate__slideOutUp animate__faster`,
      },
      customClass: {
        confirmButton: 'btn btn-primary btn-lg mr-2',
        denyButton: 'btn btn-danger btn-lg',
        popup: 'rounded-4 glass',
      },
      confirmButtonText: 'Confermo',
      denyButtonText: `Annulla`,
      didOpen: () => {
        (window as any).swalUpdateTotal = () => {
          let sum = 0;
          document.querySelectorAll<HTMLInputElement>('input[data-cost]').forEach((el) => {
            const c = parseFloat(el.dataset['cost'] || '0');
            const v = parseInt(el.value) || 0;
            sum += c * v;
          });
          const totalEl = document.getElementById('swal-refund-total');
          if (totalEl) totalEl.textContent = sum.toFixed(2) + '€';
        };
      },
      preConfirm: () => {
        const items: { ticketTypeId: string; count: number }[] = [];
        let luggageCount = 0;
        let hasSelection = false;
        document.querySelectorAll<HTMLInputElement>('input[data-cost]').forEach((el) => {
          const v = parseInt(el.value) || 0;
          if (v > 0) {
            hasSelection = true;
            if (el.dataset['ticketId'] === '__luggage__') {
              luggageCount = v;
            } else if (el.dataset['ticketId']) {
              items.push({ ticketTypeId: el.dataset['ticketId']!, count: v });
            }
          }
        });
        if (!hasSelection) {
          Swal.showValidationMessage('Seleziona almeno un biglietto da rimborsare');
          return;
        }
        return { items, luggage: luggageCount };
      },
    }).then((result: any) => {
      if (result.isConfirmed) {
        const refundData = result.value;
        this.stripeService.refund(numberOfTickets.toString(), refundData.items, refundData.luggage).subscribe({
          next: () => {
            this.filterButton();
          },
        });
      }
    });
  }
  cancella(numberOfTickets: number) {
    Swal.fire({
      title: 'Vuoi cancellare questo biglietto?',
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
        popup: 'rounded-4 glass',
      },

      showCancelButton: false,
      confirmButtonText: 'Confermo',
      denyButtonText: `Annulla`,
    }).then((result: any) => {
      /* Read more about isConfirmed, isDenied below */
      if (result.isConfirmed) {
        this.bookingsService
          .cancelBooking(numberOfTickets.toString())
          .subscribe(() => {
            let bookIndex = this.booking.findIndex(
              (b: any) => b.ticketId === numberOfTickets,
            );
            this.booking[bookIndex].status = 'cancelled';
          });
      } else if (result.isDenied) {
      }
    });
  }
  calculateSchedules(routeId: string) {
    if (routeId === '') this.filterSchedule = [];
    let route = this.routes.find((t: any) => t.id === routeId);
    let ris = route?.schedules.map((s: any) => {
      return {
        name: s.departureTime + ' - ' + s.arrivalTime,
        id: s.id,
      };
    });

    this.filterSchedule = ris;
  }
  async filterButton() {
    this.booking = [];
    this.loading = true;
    let ris: any = await lastValueFrom(
      this.bookingsService.readBookingConfirmed(
        this.filter.date,
        this.filter.routeId,
        this.filter.scheduleId,
        this.filter.show,
      ),
    );
    ris = ris.ticket || [];

    this.booking = ris.map((t: any) => {
      return {
        total: t.total,
        ticketId: t.numberOfTickets,
        status: t.status,
        paymentMethod: t.paymentMethod,
        ticket: t.ticketTypes,
        route: t.name.it,
        from: t.from.name + ' (' + t.from.stopTime + ')',
        to: t.to.name + ' (' + t.to.stopTime + ')',
        name: t.user.name,
        mail: t.user.mail,
        phone: t.user.phone,
        bagagli: t.luggage,
        refundedAmount: t.refundedAmount || 0,
      };
    });

    setTimeout(() => {
      this.loading = false;
    }, 300);
  }
}
