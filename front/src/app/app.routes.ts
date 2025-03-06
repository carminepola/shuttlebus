import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';

import { HomeComponent } from './pages/home/home.component';
import { ImpostazioniComponent } from './pages/impostazioni/impostazioni.component';
import { UserSettingsComponent } from './pages/user-settings/user-settings.component';
import { LostPasswordComponent } from './pages/lost-password/lost-password.component';
import { StopsComponent } from './pages/stops/stops.component';
import { StopDetailsComponent } from './pages/stop-details/stop-details.component';
import { RouteComponent } from './pages/route/route.component';
import { ReservationComponent } from './pages/reservation/reservation.component';
import { TicketsTypeComponent } from './pages/tickets-type/tickets-type.component';
import { UsersComponent } from './pages/users/users.component';
import { ClientsComponent } from './pages/clients/clients.component';
import { HomepageComponent } from './pages/homepage/homepage.component';
import { InfoComponent } from './pages/info/info.component';
import { TicketTypeDetailsComponent } from './pages/ticket-type-details/ticket-type-details.component';
import { TraduzioniComponent } from './pages/traduzioni/traduzioni/traduzioni.component';
import { RouteDetailsComponent } from './pages/route-details/route-details.component';
import { ScheduleListComponent } from './pages/schedule-list/schedule-list.component';
import { ScheduleComponent } from './pages/schedule/schedule.component';
import { SearchPageComponent } from './pages/search-page/search-page.component';
import { RiepilogoComponent } from './pages/riepilogo/riepilogo.component';
import { TestComponent } from './pages/test/test.component';
import { AuthPageComponent } from './pages/auth-page/auth-page.component';
import { AuthGuard } from './services/guard/auth.guard';
import { UserProfileComponent } from './pages/user-profile/user-profile.component';
export const routes: Routes = [
  {
    path: '',
    component: HomepageComponent,
    data: { lowBar: true },
  },
  {
    path: 'auth/:id',
    component: AuthPageComponent,
    data: {},
    pathMatch: 'full',
  },
  { path: 'lostpassword', component: LostPasswordComponent, data: {} },
  {
    path: 'test',
    component: TestComponent,
    data: { lowBar: false },
  },
  {
    path: 'info',
    component: InfoComponent,
    canActivate: [],
    data: { lowBar: true },
  },
  {
    path: 'search/:partenza/:arrivo/:persone/:data/:bagagli',
    component: SearchPageComponent,
    canActivate: [],
    data: { lowBar: true },
  },
  {
    path: 'riepilogo',
    component: RiepilogoComponent,
    canActivate: [],
    data: { lowBar: true },
  },
  {
    path: 'user',
    children: [
      {
        path: 'account',
        component: UserProfileComponent,
        canActivate: [AuthGuard],
        data: { lowBar: true, requiredRole: 100 },
      },
    ],
  },

  {
    path: 'admin',

    children: [
      {
        path: 'fermate',
        component: StopsComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'login',
        component: LoginComponent,

        data: { navbar: false },
      },
      {
        path: 'home',

        component: HomeComponent,

        canActivate: [AuthGuard],
        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'settings',
        component: ImpostazioniComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'usersettings',
        component: UserSettingsComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'fermata/:id',
        component: StopDetailsComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'fermata',
        component: StopDetailsComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'ticket-details',
        component: TicketTypeDetailsComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'ticket-details/:id',
        component: TicketTypeDetailsComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'corse',
        component: RouteComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'route',
        component: RouteDetailsComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'route/:id',
        component: RouteDetailsComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'prenotazioni',
        component: ReservationComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'biglietti',
        component: TicketsTypeComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'utenti',
        component: UsersComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'clienti',
        component: ClientsComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'traduzioni',
        component: TraduzioniComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'schedules/:idRoute',
        component: ScheduleListComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'schedule/:idRoute',
        component: ScheduleComponent,

        data: { navbar: true, requiredRole: 50 },
      },
      {
        path: 'schedule/:idRoute/:idSchedule',
        component: ScheduleComponent,

        data: { navbar: true, requiredRole: 50 },
      },
    ],
  },

  { path: '', redirectTo: '/', pathMatch: 'full' },
  { path: '**', component: NotFoundComponent },
];
