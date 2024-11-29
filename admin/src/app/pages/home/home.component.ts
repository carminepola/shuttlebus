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
Chart.register(...registerables);

interface DashboardCard {
  icon: string;
  title: string;
  description: string;
  color: string;
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
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit, AfterViewInit {
  @ViewChild('salesChart') salesChart!: ElementRef;

  user: any
  username = '';
  email = '';
  isMenuOpen = false;



  dashboardCards: DashboardCard[] = [
    {
      icon: 'fa-map-marker-alt',
      title: 'Fermate',
      description: 'Gestisci le fermate del servizio',
      color: 'bg-gradient-to-br from-blue-600 to-blue-800',
    },
    {
      icon: 'fa-route',
      title: 'Corse',
      description: 'Pianifica e gestisci le corse',
      color: 'bg-gradient-to-br from-teal-600 to-teal-800',
    },
    {
      icon: 'fa-ticket-alt',
      title: 'Biglietti',
      description: 'Gestione biglietti e abbonamenti',
      color: 'bg-gradient-to-br from-violet-600 to-violet-800',
    },
    {
      icon: 'fa-calendar-check',
      title: 'Prenotazioni',
      description: 'Visualizza e gestisci le prenotazioni',
      color: 'bg-gradient-to-br from-rose-600 to-rose-800',
    },
  ];

  constructor(private authService: AuthService) { }

  ngOnInit(): void {

    this.user = this.authService.getDecodedToken();
    this.username = this.user?.details?.name;
    this.email = this.user.email;
  }

  ngAfterViewInit() {
    this.createSalesChart();
  }

  private createSalesChart() {
    const ctx = this.salesChart.nativeElement.getContext('2d');

    // Generate dates for previous, current, and next month
    const dates = this.generateDates();

    // Generate random sales data
    const previousMonthData = this.generateRandomData(31, 50, 150);
    const currentMonthData = this.generateRandomData(31, 80, 200);
    const nextMonthData = this.generateRandomData(31, 100, 250);

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
          },
          {
            label: 'Mese Corrente',
            data: currentMonthData,
            borderColor: '#ec2a7a',
            backgroundColor: 'rgba(236, 42, 122, 0.1)',
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Mese Successivo',
            data: nextMonthData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
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

  private generateRandomData(
    count: number,
    min: number,
    max: number
  ): number[] {
    return Array.from(
      { length: count },
      () => Math.floor(Math.random() * (max - min + 1)) + min
    );
  }



  logout() {
    console.log('Logout clicked');
  }
}

