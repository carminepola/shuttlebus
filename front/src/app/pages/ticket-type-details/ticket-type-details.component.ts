import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { FormsModule, ReactiveFormsModule, NgForm } from '@angular/forms';

import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { ActivatedRoute, Router } from '@angular/router';
import { TicketTypeService } from '../../services/ticket-type/ticket-type.service';
import { fadeAnimation } from '../../animations/fade.animation';
import { WEEK_DAYS, weekdayName } from '../../utils/ticket-days';
@Component({
  selector: 'app-ticket-type-details',
  imports: [
    TitlePageComponent,
    FormsModule,
    LoadingComponent,
    ReactiveFormsModule
],
  animations: [fadeAnimation],
  templateUrl: './ticket-type-details.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './ticket-type-details.component.scss',
})
export class TicketTypeDetailsComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ticketTypeService: TicketTypeService
  ) {}
  id: string = '';

  loading: boolean = true;

  form: any = {
    name: { it: '', en: '', fr: '', de: '', es: '', jp: '' },
    cost: '0',
    isActive: true,
    showOnHome: true,
    daysOfWeek: [],
    description: { it: '', en: '', fr: '', de: '', es: '', jp: '' },
  };
  errorMessage: string = '';
  weekDays = WEEK_DAYS;

  dayName(day: number): string {
    return weekdayName(day, 'it', 'long');
  }

  hasDay(day: number): boolean {
    return (this.form.daysOfWeek || []).includes(day);
  }

  /** Nessun giorno selezionato = biglietto valido tutti i giorni. */
  toggleDay(day: number) {
    const days: number[] = this.form.daysOfWeek || [];
    this.form.daysOfWeek = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day].sort((a, b) => a - b);
  }

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.id = params['id'];
      if (this.id) {
        this.load(this.id);
      } else {
        this.loading = false;
      }
    });
  }
  onSubmit(form: NgForm) {
    if (form.valid) {
      this.loading = true;

      if (!this.id) {
        this.ticketTypeService.createTicketType(this.form).subscribe({
          next: (response: any) => {
            this.loading = false;
            window.history.back();
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
      } else {
        this.ticketTypeService.updateTicketType(this.form).subscribe({
          next: (response: any) => {
            this.loading = false;
            window.history.back();
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
  load(id: string) {
    this.ticketTypeService.getTicketType(id).subscribe((res) => {
      this.loading = false;
      if (res && res.ticketType) {
        this.form = res.ticketType;
        this.form.daysOfWeek = this.form.daysOfWeek || [];
        this.form.showOnHome = this.form.showOnHome !== false;
        this.cdr.detectChanges();
      }
    });
  }
}
