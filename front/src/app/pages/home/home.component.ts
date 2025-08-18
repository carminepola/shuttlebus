import {
  Component,
  OnInit,
  AfterViewInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Chart, registerables } from 'chart.js';

import { fadeAnimation } from '../../animations/fade.animation';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { BookingsService } from '../../services/bookings/bookings.service';
import { RoutesService } from '../../services/routes/routes.service';

import { StripeService } from '../../services/stripe/stripe.service';
Chart.register(...registerables);

interface DashboardCard {
  icon: string;
  title: string;
  description: string;
  color: string;
  link: string;
}

interface MenuItem {
  icon: string;
  title: string;
  route: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  animations: [fadeAnimation],
  imports: [CommonModule, RouterModule, TitlePageComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit, AfterViewInit {
  @ViewChild('salesChart') salesChart!: ElementRef;
  @ViewChild('salesChartVendite') salesChartVendite!: ElementRef;
  loadCorse = true;
  loadPrenotazioni = true;
  loadBiglietti = true;
  loadAndamento = true;
  loadAndamentoVendite = true;
  loadBalance = true;
  loadPayouts = true;
  loadAccountSchedule = true;

  public andamentoMese: any = [];
  public countRoutes: number = 0;
  public countPrenotazioni: number = 0;
  public countBiglietti: number = 0;
  public payouts: any;
  public balance: any;
  public accountSchedule: any;

  user: any;
  username = '';
  email = '';
  isMenuOpen = false;

  dashboardCards: DashboardCard[] = [
    {
      icon: 'fa-map-marker-alt',
      title: 'Fermate',
      link: '/admin/fermate',
      description: 'Gestisci le fermate del servizio',
      color: 'cardButton card-gradient-blue text-white',
    },
    {
      icon: 'fa-route',
      title: 'Corse',
      link: '/admin/corse',
      description: 'Pianifica e gestisci le corse',
      color: 'cardButton card-gradient-green',
    },
    {
      icon: 'fa-ticket-alt',
      title: 'Biglietti',
      description: 'Gestione biglietti',
      link: '/admin/biglietti',
      color: ' cardButton card-gradient-violet',
    },
    {
      icon: 'fa-calendar-check',
      title: 'Prenotazioni',
      link: '/admin/prenotazioni',
      description: 'Visualizza  le prenotazioni',
      color: 'cardButton card-gradient-red',
    },
  ];

  constructor(
    private bookingsService: BookingsService,
    private routesService: RoutesService,
    private stripeService: StripeService
  ) {}

  private interval: any;
  ngOnDestroy(): void {
    clearInterval(this.interval);
  }
  ngOnInit(): void {
    this.andamentoVendite();
    this.andamento();
    this.getPayouts();
    this.getBalance();
    this.getAccountSchedule();
    setTimeout(() => {
      this.routeToday();
      this.biglietti();
      this.prenotazioni();
    }, 500);
  }

  getPayouts() {
    this.stripeService.getPayouts().subscribe((res: any) => {
      this.payouts = res;
      this.loadPayouts = false;
    });
  }
  getBalance() {
    this.stripeService.getBalance().subscribe((res: any) => {
      this.balance = res;
      this.loadBalance = false;
    });
  }
  getAccountSchedule() {
    this.stripeService.getAccountSchedule().subscribe((res: any) => {
      this.accountSchedule = res;
      this.loadAccountSchedule = false;
    });
  }
  prenotazioni() {
    this.bookingsService.seatsToDay().subscribe((res: any) => {
      this.loadPrenotazioni = false;
      if (res) {
        setTimeout(() => {
          this.animateNumberBiglietti(res.seats, 100);
        }, 100);
      }
    });
  }
  biglietti() {
    this.bookingsService.ticketToDay().subscribe((res: any) => {
      this.loadBiglietti = false;
      if (res) {
        setTimeout(() => {
          this.animateNumberPrenotazioni(res.ticket, 100);
        }, 100);
      }
    });
  }

  andamento() {
    this.bookingsService.andamento().subscribe((res: any) => {
      this.loadAndamento = false;
      if (res) {
        setTimeout(() => {
          this.createSalesChart(res.andamento);
        }, 100);
      }
    });
  }
  andamentoVendite() {
    this.bookingsService.andamentoVendite().subscribe((res: any) => {
      this.loadAndamentoVendite = false;
      if (res) {
        setTimeout(() => {
          this.createSalesChartVendite(res.andamento);
        }, 100);
      }
    });
  }
  routeToday() {
    this.routesService.getRoutesToDay().subscribe((res: any) => {
      this.loadCorse = false;
      if (res) {
        this.animateNumberRoutes(res.routes, 100);
      }
    });
  }

  ngAfterViewInit() {}
  animateNumberRoutes(max: number, duration: number) {
    if (max != this.countRoutes) {
      let start = 0;
      let stepTime = Math.abs(Math.floor(duration / max)); // Tempo per ogni incremento

      let interval = setInterval(() => {
        start++;
        this.countRoutes = start;
        if (start >= max) clearInterval(interval);
      }, stepTime);
    }
  }

  animateNumberPrenotazioni(max: number, duration: number) {
    if (max != this.countPrenotazioni) {
      let start = 0;
      let stepTime = Math.abs(Math.floor(duration / max)); // Tempo per ogni incremento

      let interval = setInterval(() => {
        start++;
        this.countPrenotazioni = start;
        if (start >= max) clearInterval(interval);
      }, stepTime);
    }
  }
  animateNumberBiglietti(max: number, duration: number) {
    if (max != this.countBiglietti) {
      let start = 0;
      let stepTime = Math.abs(Math.floor(duration / max)); // Tempo per ogni incremento

      let interval = setInterval(() => {
        start++;
        this.countBiglietti = start;
        if (start >= max) clearInterval(interval);
      }, stepTime);
    }
  }
  private createSalesChart(data: any) {
    const ctx = this.salesChart.nativeElement.getContext('2d');
    const dates = this.generateDates();

    const previousMonthMap: { [key: string]: number } = {};
    const currentMonthMap: { [key: string]: number } = {};
    const nextMonthMap: { [key: string]: number } = {};

    data.forEach((item: any) => {
      const day = new Date(item.date).getDate();
      if (item.period === 'past') {
        previousMonthMap[day] = item.totalTickets;
      } else if (item.period === 'current') {
        currentMonthMap[day] = item.totalTickets;
      } else if (item.period === 'next') {
        nextMonthMap[day] = item.totalTickets;
      }
    });

    const previousMonthData = dates.map((day) => previousMonthMap[day] || 0);
    const currentMonthData = dates.map((day) => currentMonthMap[day] || 0);
    const nextMonthData = dates.map((day) => nextMonthMap[day] || 0);

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'Mese Precedente',
            data: previousMonthData,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 6,
          },
          {
            label: 'Mese Corrente',
            data: currentMonthData,
            borderColor: '#ec2a7a',
            backgroundColor: 'rgba(236, 42, 122, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 6,
          },
          {
            label: 'Mese Successivo',
            data: nextMonthData,
            borderColor: '#34d399',
            backgroundColor: 'rgba(52, 211, 153, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        aspectRatio: 1.5,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: 'Andamento Vendite',
            font: {
              size: 16,
            },
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          },
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Numero di biglietti venduti',
            },
          },
          x: {
            title: {
              display: true,
              text: 'Giorno del Mese',
            },
          },
        },
      },
    });
  }
  private createSalesChartVendite(data: any) {
    const ctx = this.salesChartVendite.nativeElement.getContext('2d');
    const dates = this.generateDates();

    const previousMonthMap: { [key: string]: number } = {};
    const currentMonthMap: { [key: string]: number } = {};
    const nextMonthMap: { [key: string]: number } = {};

    data.forEach((item: any) => {
      const day = new Date(item.date).getDate();
      if (item.period === 'past') {
        previousMonthMap[day] = item.totalRevenue;
      } else if (item.period === 'current') {
        currentMonthMap[day] = item.totalRevenue;
      } else if (item.period === 'next') {
        nextMonthMap[day] = item.totalRevenue;
      }
    });

    const previousMonthData = dates.map((day) => previousMonthMap[day] || 0);
    const currentMonthData = dates.map((day) => currentMonthMap[day] || 0);
    const nextMonthData = dates.map((day) => nextMonthMap[day] || 0);

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'Mese Precedente',
            data: previousMonthData,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 0, // Nasconde i pallini
            pointHoverRadius: 6, // Mostra il pallino solo in hover
          },
          {
            label: 'Mese Corrente',
            data: currentMonthData,
            borderColor: '#ec2a7a',
            backgroundColor: 'rgba(236, 42, 122, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 6,
          },
          {
            label: 'Mese Successivo',
            data: nextMonthData,
            borderColor: '#34d399',
            backgroundColor: 'rgba(52, 211, 153, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        aspectRatio: 1.5,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: 'Andamento incasso',
            font: {
              size: 16,
            },
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function (context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += context.parsed.y + ' €';
                }
                return label;
              },
            },
          },
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Euro €',
            },
            ticks: {
              callback: function (value) {
                return value + ' €';
              },
            },
          },
          x: {
            title: {
              display: true,
              text: 'Giorno del Mese',
            },
          },
        },
      },
    });
  }
  private generateDates(): string[] {
    const dates = [];
    for (let i = 1; i <= 31; i++) {
      dates.push(i.toString());
    }
    return dates;
  }

  logout() {
    console.log('Logout clicked');
  }
}
