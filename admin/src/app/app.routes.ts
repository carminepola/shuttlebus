import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';
import { AuthGuard } from './services/guard/auth.guard';
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
export const routes: Routes = [
  {
    path: '',
    component: HomepageComponent,
    data: { lowBar: true },
  },

  {
    path: 'info',
    component: InfoComponent,
    canActivate: [],
    data: { lowBar: true },
  },

  {
    path: 'admin',
    data: { navbar: false },
    children: [
      {
        path: 'fermate',
        component: StopsComponent,
        canActivate: [AuthGuard],
        data: { navbar: true },
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
        data: { navbar: true },
      },
      {
        path: 'settings',
        component: ImpostazioniComponent,
        canActivate: [AuthGuard],
        data: { navbar: true },
      },
      {
        path: 'usersettings',
        component: UserSettingsComponent,
        canActivate: [AuthGuard],
        data: { navbar: true },
      },
      {
        path: 'fermata/:id',
        component: StopDetailsComponent,
        canActivate: [AuthGuard],
        data: { navbar: true },
      },
      {
        path: 'fermata',
        component: StopDetailsComponent,
        canActivate: [AuthGuard],
        data: { navbar: true },
      },
      {
        path: 'ticket-details',
        component: TicketTypeDetailsComponent,
        canActivate: [AuthGuard],
        data: { navbar: true },
      },
      {
        path: 'ticket-details/:id',
        component: TicketTypeDetailsComponent,
        canActivate: [AuthGuard],
        data: { navbar: true },
      },
      {
        path: 'corse',
        component: RouteComponent,
        canActivate: [AuthGuard],
        data: { navbar: true },
      },
      {
        path: 'prenotazioni',
        component: ReservationComponent,
        canActivate: [AuthGuard],
        data: { navbar: true },
      },
      {
        path: 'biglietti',
        component: TicketsTypeComponent,
        canActivate: [AuthGuard],
        data: { navbar: true },
      },
      {
        path: 'utenti',
        component: UsersComponent,
        canActivate: [AuthGuard],
        data: { navbar: true },
      },
      {
        path: 'clienti',
        component: ClientsComponent,
        canActivate: [AuthGuard],
        data: { navbar: true },
      },
      { path: 'lostpassword', component: LostPasswordComponent, data: {} },
    ],
  },

  { path: '', redirectTo: '/', pathMatch: 'full' },
  { path: '**', component: NotFoundComponent },
];
