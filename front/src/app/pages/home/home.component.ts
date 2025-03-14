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
import { AuthService } from '../../services/auth/auth.service';
import { fadeAnimation } from '../../animations/fade.animation';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { BookingsService } from '../../services/bookings/bookings.service';
import { RoutesService } from '../../services/routes/routes.service';
import { interval } from 'rxjs';

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

  loadCorse = true;
  loadPrenotazioni = true;
  loadBiglietti = true;
  loadAndamento = true;

  public andamentoMese: any = [];
  public countRoutes: number = 0;
  public countPrenotazioni: number = 0;
  public countBiglietti: number = 0;

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
    private authService: AuthService,
    private bookingsService: BookingsService,
    private routesService: RoutesService
  ) {}

  private interval: any;
  ngOnDestroy(): void {
    clearInterval(this.interval);
  }
  ngOnInit(): void {
    this.andamento();
    setTimeout(() => {
      this.routeToday();
      this.biglietti();
      this.prenotazioni();
    }, 500);

    setInterval(() => {
      this.andamento();
      this.routeToday();
      this.biglietti();
      this.prenotazioni();
    }, 60000);
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
        debugger;
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

    // Genera i giorsni del mese
    const dates = this.generateDates();

    // Creiamo mappe per associare i dati ai giorni corretti
    const previousMonthMap: { [key: string]: number } = {};
    const currentMonthMap: { [key: string]: number } = {};

    // Popoliamo le mappe con i dati
    data.forEach((item: any) => {
      const day = new Date(item.date).getDate(); // Estraggo il giorno dal timestamp
      if (item.period === 'past') {
        previousMonthMap[day] = item.totalTickets;
      } else if (item.period === 'current') {
        currentMonthMap[day] = item.totalTickets;
      }
    });

    // Allineiamo i dati ai giorni del mese
    const previousMonthData = dates.map((day) => previousMonthMap[day] || 0);
    const currentMonthData = dates.map((day) => currentMonthMap[day] || 0);

    console.log('Date:', dates);
    console.log('Mese Precedente:', previousMonthData);
    console.log('Mese Corrente:', currentMonthData);

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates, // Etichette = Giorni del mese
        datasets: [
          {
            label: 'Mese Precedente',
            data: previousMonthData, // Dati allineati
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Mese Corrente',
            data: currentMonthData, // Dati allineati
            borderColor: '#ec2a7a',
            backgroundColor: 'rgba(236, 42, 122, 0.1)',
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
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
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Numero di Vendite',
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
