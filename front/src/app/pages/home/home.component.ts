import {
  Component,
  OnInit,
  AfterViewInit,
  ElementRef,
  ViewChild,
  OnDestroy,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';

import { fadeAnimation } from '../../animations/fade.animation';
import { TitlePageComponent } from '../../components/title-page/title-page.component';

import { BookingsService } from '../../services/bookings/bookings.service';
import { RoutesService } from '../../services/routes/routes.service';

import { StripeService } from '../../services/stripe/stripe.service';
import { LUGGAGE_PRICE } from '../../constants/app.constants';
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

interface TopClient {
  userId: string;
  userName: string;
  userEmail: string;
  totalSpent: number;
  totalBookings: number;
}

interface RecentPurchase {
  numberOfTickets: string;
  date: string;
  createdAt: number;
  status: string;
  from: { name: string };
  to: { name: string };
  total: number;
  luggage: number;
  seats: number;
  name: { it: string };
  user: { name: string; mail: string };
}

interface YoYMonth {
  month: number;
  label: string;
  key: string;
  current: { revenue: number; tickets: number; seats: number };
  previous: { revenue: number; tickets: number; seats: number };
}

interface YearlyComparison {
  currentYear: number;
  previousYear: number;
  currentTotal: { revenue: number; tickets: number; seats: number };
  previousTotal: { revenue: number; tickets: number; seats: number };
  revenueChange: number;
  ticketsChange: number;
  seatsChange: number;
  avgTicketCurrent: number;
  avgTicketPrevious: number;
  avgTicketChange: number;
  months: YoYMonth[];
}

interface Tratta {
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  current: { bookings: number; seats: number; revenue: number };
  previous: { bookings: number; seats: number; revenue: number };
  bookingsChange: number | null;
}

interface TratteLine {
  routeId: string;
  routeName: { it: string; en: string } | null;
  current: { bookings: number; seats: number; revenue: number };
  previous: { bookings: number; seats: number; revenue: number };
  bookingsChange: number | null;
  tratte: Tratta[];
}

interface TratteYearlyComparison {
  currentYear: number;
  previousYear: number;
  lines: TratteLine[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  animations: [fadeAnimation],
  imports: [CommonModule, RouterModule, TitlePageComponent, FormsModule],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  public luggagePrice = LUGGAGE_PRICE;
  @ViewChild('salesChart') salesChart!: ElementRef;
  @ViewChild('salesChartVendite') salesChartVendite!: ElementRef;
  @ViewChild('purchasesScroll') purchasesScroll!: ElementRef;
  @ViewChild('revenueChart') revenueChart!: ElementRef;
  loadCorse = true;
  loadPrenotazioni = true;
  loadBiglietti = true;
  loadAndamento = true;
  loadAndamentoVendite = true;
  loadBalance = true;
  loadPayouts = true;
  loadAccountSchedule = true;
  loadTopClients = true;
  loadRecentPurchases = true;
  loadRefunds = true;
  loadMonthlyRevenue = true;
  loadDisputes = true;
  loadDashboardStats = true;
  loadRevenueByPayment = true;
  loadDailyRouteRevenue = true;
  loadYearlyComparison = true;

  public dashboardStats: any = null;
  public revenueByPayment: any = null;
  public yearlyComparison: YearlyComparison | null = null;
  public tratteComparison: TratteYearlyComparison | null = null;
  public loadTratte = true;
  public dailyRouteRevenue: any[] = [];
  public dailyRouteDate: string = new Date().toISOString().split('T')[0];

  public andamentoMese: any = [];
  public countRoutes: number = 0;
  public countPrenotazioni: number = 0;
  public countBiglietti: number = 0;
  public payouts: any;
  public balance: any;
  public accountSchedule: any;
  public topClients: TopClient[] = [];
  public recentPurchases: RecentPurchase[] = [];
  public purchasesPage = 1;
  public purchasesTotal = 0;
  public purchasesLimit = 15;
  public purchasesLoadingMore = false;
  public hasMorePurchases = true;
  public refunds: any[] = [];
  public disputes: any[] = [];
  public monthlyRevenue: any = null;

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
    private stripeService: StripeService,
  ) {}

  private interval: any;
  private purchasePollingInterval: any;
  ngOnDestroy(): void {
    clearInterval(this.interval);
    if (this.purchasePollingInterval)
      clearInterval(this.purchasePollingInterval);
  }
  ngOnInit(): void {
    this.andamentoVendite();
    this.andamento();
    this.getPayouts();
    this.getBalance();
    this.getAccountSchedule();
    this.getTopClients();
    this.getRecentPurchases();
    this.getRefunds();
    this.getDisputes();
    this.getMonthlyRevenue();
    this.getDashboardStats();
    this.getRevenueByPaymentMethod();
    this.getDailyRevenueByRoute();
    this.getYearlyComparison();
    this.getTratteYearlyComparison();
    setTimeout(() => {
      this.routeToday();
      this.biglietti();
      this.prenotazioni();
    }, 500);

    this.purchasePollingInterval = setInterval(() => {
      this.getRecentPurchases(true);
    }, 60000);
  }

  getPayouts() {
    this.stripeService.getPayouts().subscribe((res: any) => {
      res.result = res.result.slice(0, 4);
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
      let stepTime = Math.abs(Math.floor(duration / max));

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
      let stepTime = Math.abs(Math.floor(duration / max));

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
      let stepTime = Math.abs(Math.floor(duration / max));

      let interval = setInterval(() => {
        start++;
        this.countBiglietti = start;
        if (start >= max) clearInterval(interval);
      }, stepTime);
    }
  }
  private createSalesChart(apiData: any) {
    const ctx = this.salesChart.nativeElement.getContext('2d');
    const dates = this.generateDates();
    const data = apiData.completeData || apiData;

    const previousMonthMap: { [key: string]: number } = {};
    const currentMonthMap: { [key: string]: number } = {};
    const nextMonthMap: { [key: string]: number } = {};
    const yearAgoMap: { [key: string]: number } = {};

    data.forEach((item: any) => {
      const day = new Date(item.date).getDate();
      if (item.period === 'past') {
        previousMonthMap[day] = item.totalTickets;
      } else if (item.period === 'current') {
        currentMonthMap[day] = item.totalTickets;
      } else if (item.period === 'next') {
        nextMonthMap[day] = item.totalTickets;
      } else if (item.period === 'yearAgo') {
        yearAgoMap[day] = (yearAgoMap[day] || 0) + (item.totalTickets || 0);
      }
    });

    const previousMonthData = dates.map((day) => previousMonthMap[day] || 0);
    const currentMonthData = dates.map((day) => currentMonthMap[day] || 0);
    const nextMonthData = dates.map((day) => nextMonthMap[day] || 0);
    const yearAgoData = dates.map((day) => yearAgoMap[day] || 0);

    const lastYear = new Date().getFullYear() - 1;

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
          {
            label: `${lastYear} stesso periodo`,
            data: yearAgoData,
            borderColor: '#f97316',
            backgroundColor: 'transparent',
            borderDash: [6, 4],
            tension: 0.4,
            fill: false,
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
  private createSalesChartVendite(apiData: any) {
    const ctx = this.salesChartVendite.nativeElement.getContext('2d');
    const dates = this.generateDates();
    const data = apiData.completeData || apiData;

    const previousMonthMap: { [key: string]: number } = {};
    const currentMonthMap: { [key: string]: number } = {};
    const nextMonthMap: { [key: string]: number } = {};
    const yearAgoMap: { [key: string]: number } = {};

    data.forEach((item: any) => {
      const day = new Date(item.date).getDate();
      if (item.period === 'past') {
        previousMonthMap[day] = item.totalRevenue;
      } else if (item.period === 'current') {
        currentMonthMap[day] = item.totalRevenue;
      } else if (item.period === 'next') {
        nextMonthMap[day] = item.totalRevenue;
      } else if (item.period === 'yearAgo') {
        yearAgoMap[day] = (yearAgoMap[day] || 0) + (item.totalRevenue || 0);
      }
    });

    const previousMonthData = dates.map((day) => previousMonthMap[day] || 0);
    const currentMonthData = dates.map((day) => currentMonthMap[day] || 0);
    const nextMonthData = dates.map((day) => nextMonthMap[day] || 0);
    const yearAgoData = dates.map((day) => yearAgoMap[day] || 0);

    const lastYear = new Date().getFullYear() - 1;

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
          {
            label: `${lastYear} stesso periodo`,
            data: yearAgoData,
            borderColor: '#f97316',
            backgroundColor: 'transparent',
            borderDash: [6, 4],
            tension: 0.4,
            fill: false,
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

  getTopClients() {
    this.bookingsService.getTopClients().subscribe((res: any) => {
      this.topClients = res.topClients || [];
      this.loadTopClients = false;
    });
  }

  getRecentPurchases(reset: boolean = false) {
    if (reset) {
      this.purchasesPage = 1;
      this.hasMorePurchases = true;
    }

    if (this.purchasesLoadingMore && !reset) return;
    if (!this.hasMorePurchases && !reset) return;

    this.purchasesLoadingMore = true;

    this.bookingsService
      .getRecentPurchases(this.purchasesPage, this.purchasesLimit)
      .subscribe((res: any) => {
        if (reset) {
          this.recentPurchases = res.results || [];
        } else {
          this.recentPurchases = [
            ...this.recentPurchases,
            ...(res.results || []),
          ];
        }
        this.purchasesTotal = res.total || 0;
        this.hasMorePurchases =
          this.recentPurchases.length < this.purchasesTotal;
        this.loadRecentPurchases = false;
        this.purchasesLoadingMore = false;
      });
  }

  loadMorePurchases() {
    if (!this.hasMorePurchases || this.purchasesLoadingMore) return;
    this.purchasesPage++;
    this.getRecentPurchases();
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      confirmed: 'Confermato',
      pending: 'In attesa',
      cancelled: 'Annullato',
      refunded: 'Rimborsato',
      expired: 'Scaduto',
    };
    return map[status] || status;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      confirmed: 'bg-success-subtle text-success',
      pending: 'bg-warning-subtle text-warning',
      cancelled: 'bg-danger-subtle text-danger',
      refunded: 'bg-info-subtle text-info',
      expired: 'bg-secondary-subtle text-secondary',
    };
    return map[status] || 'bg-secondary-subtle text-secondary';
  }

  getRankColor(index: number): string {
    const colors = ['#f59e0b', '#94a3b8', '#b45309', '#6b7280', '#6b7280'];
    return colors[index] || '#6b7280';
  }

  getRankIcon(index: number): string {
    return index === 0
      ? 'fa-trophy'
      : index === 1
        ? 'fa-medal'
        : index === 2
          ? 'fa-award'
          : '';
  }

  formatPurchaseDate(createdAt: number): string {
    if (!createdAt) return '';
    const d = new Date(createdAt);
    return d.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatEuro(value: number): string {
    return value.toLocaleString('it-IT', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }) + ' €';
  }

  getMonthPct(current: number, previous: number): number {
    if (previous <= 0) return 0;
    return +((current - previous) / previous * 100).toFixed(1);
  }

  getMonthPctClass(current: number, previous: number): string {
    if (previous <= 0) return 'bg-secondary-subtle text-secondary';
    return current >= previous
      ? 'bg-success-subtle text-success'
      : 'bg-danger-subtle text-danger';
  }

  onPurchasesScroll() {
    const el = this.purchasesScroll?.nativeElement;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 50;
    if (atBottom) {
      this.loadMorePurchases();
    }
  }

  getRefunds() {
    this.stripeService.getRefunds().subscribe((res: any) => {
      this.refunds = res.result || [];
      this.loadRefunds = false;
    });
  }

  getDisputes() {
    this.stripeService.getDisputes().subscribe((res: any) => {
      this.disputes = res.result || [];
      this.loadDisputes = false;
    });
  }

  closeDispute(disputeId: string) {
    this.stripeService.closeDispute(disputeId).subscribe(() => {
      this.getDisputes();
    });
  }

  getDisputeStatusLabel(status: string): string {
    const map: Record<string, string> = {
      warning_needs_response: 'Richiede risposta',
      warning_under_review: 'In revisione',
      needs_response: 'Richiede risposta',
      under_review: 'In revisione',
      charge_refunded: 'Rimborsato',
      lost: 'Persa',
      won: 'Vinta',
      closed: 'Chiusa',
    };
    return map[status] || status;
  }

  getDisputeStatusClass(status: string): string {
    const map: Record<string, string> = {
      warning_needs_response: 'bg-danger-subtle text-danger',
      needs_response: 'bg-danger-subtle text-danger',
      warning_under_review: 'bg-warning-subtle text-warning',
      under_review: 'bg-warning-subtle text-warning',
      charge_refunded: 'bg-info-subtle text-info',
      lost: 'bg-secondary-subtle text-secondary',
      won: 'bg-success-subtle text-success',
      closed: 'bg-secondary-subtle text-secondary',
    };
    return map[status] || 'bg-secondary-subtle text-secondary';
  }

  getDisputeReasonLabel(reason: string): string {
    const map: Record<string, string> = {
      duplicate: 'Duplicato',
      fraudulent: 'Frode',
      subscription_canceled: 'Abbonamento cancellato',
      product_unacceptable: 'Prodotto inaccettabile',
      product_not_received: 'Prodotto non ricevuto',
      unrecognized: 'Non riconosciuto',
      credit_not_processed: 'Credito non elaborato',
      general: 'Generale',
      bank_cannot_process: 'Banca: non elaborabile',
      check_returned: 'Assegno restituito',
      customer_initiated: 'Avviata dal cliente',
      debit_not_authorized: 'Addebito non autorizzato',
      insufficient_funds: 'Fondi insufficienti',
      incorrect_account_details: 'Dettagli conto errati',
      late_presentment: 'Presentazione tardiva',
      manage_dispute_reason_account_closed: 'Conto chiuso',
    };
    return map[reason] || reason;
  }

  getPendingDisputesCount(): number {
    return this.disputes.filter(
      (d: any) =>
        d.status === 'needs_response' || d.status === 'warning_needs_response',
    ).length;
  }

  getDashboardStats() {
    this.bookingsService.getDashboardStats().subscribe((res: any) => {
      this.dashboardStats = res;
      this.loadDashboardStats = false;
    });
  }

  getYearlyComparison() {
    this.bookingsService.getYearlyComparison().subscribe({
      next: (res: any) => {
        this.yearlyComparison = res;
        this.loadYearlyComparison = false;
      },
      error: () => {
        this.loadYearlyComparison = false;
      },
    });
  }

  getTratteYearlyComparison() {
    this.bookingsService.getTratteYearlyComparison().subscribe({
      next: (res: any) => {
        this.tratteComparison = res;
        this.loadTratte = false;
      },
      error: () => {
        this.loadTratte = false;
      },
    });
  }

  public expandedLines: Set<string> = new Set();

  isLineExpanded(routeId: string): boolean {
    return this.expandedLines.has(routeId);
  }

  toggleLine(routeId: string) {
    if (this.expandedLines.has(routeId)) {
      this.expandedLines.delete(routeId);
    } else {
      this.expandedLines.add(routeId);
    }
  }

  getRouteName(line: TratteLine): string {
    return (
      line.routeName?.it || line.routeName?.en || 'Linea #' + line.routeId
    );
  }

  getMonthlyRevenue() {
    this.bookingsService.getMonthlyRevenue().subscribe((res: any) => {
      this.monthlyRevenue = res.result;
      this.loadMonthlyRevenue = false;
      if (res.result?.last6Months) {
        setTimeout(() => {
          this.createRevenueChart(res.result.last6Months);
        }, 100);
      }
    });
  }

  getRevenueByPaymentMethod() {
    const year = new Date().getFullYear();
    this.bookingsService
      .getRevenueByPaymentMethod(`${year}-01-01`, `${year}-12-31`)
      .subscribe((res: any) => {
        this.revenueByPayment = res;
        this.loadRevenueByPayment = false;
      });
  }

  getDailyRevenueByRoute() {
    if (!this.dailyRouteDate) return;
    this.loadDailyRouteRevenue = true;
    this.bookingsService
      .getDailyRevenueByRoute(this.dailyRouteDate)
      .subscribe((res: any) => {
        this.dailyRouteRevenue = res.result || [];
        this.loadDailyRouteRevenue = false;
      });
  }

  onDailyDateChange() {
    this.getDailyRevenueByRoute();
  }

  getRoutePaymentTotal(byPayment: any[], method: string): number {
    if (!byPayment) return 0;
    const found = byPayment.find((p: any) => {
      const m =
        typeof p.method === 'string' ? p.method : p.method?.type || 'unknown';
      return m === method;
    });
    return found ? found.total : 0;
  }

  getDailyTotals(field: string): number {
    return this.dailyRouteRevenue.reduce(
      (s: number, r: any) => s + (r[field] || 0),
      0,
    );
  }

  getDailyPaymentTotal(method: string): number {
    return this.dailyRouteRevenue.reduce(
      (s: number, r: any) => s + this.getRoutePaymentTotal(r.byPayment, method),
      0,
    );
  }

  private createRevenueChart(
    data: { month: string; revenue: number; refunds: number }[],
  ) {
    const ctx = this.revenueChart?.nativeElement?.getContext('2d');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map((d) => d.month),
        datasets: [
          {
            label: 'Ricavi',
            data: data.map((d) => d.revenue),
            backgroundColor: 'rgba(52, 211, 153, 0.7)',
            borderColor: '#34d399',
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: 'Rimborsi',
            data: data.map((d) => d.refunds),
            backgroundColor: 'rgba(239, 68, 68, 0.5)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (context: any) =>
                context.dataset.label +
                ': ' +
                context.parsed.y.toFixed(2) +
                ' €',
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (value: any) => value + ' €' },
          },
        },
      },
    });
  }

  logout() {
    console.log('Logout clicked');
  }
}
