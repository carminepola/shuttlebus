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
export const routes: Routes = [
  { path: 'login', component: LoginComponent, data: {} },
  { path: 'lostpassword', component: LostPasswordComponent, data: {} },
  {
    path: 'fermate',
    component: StopsComponent,
    canActivate: [AuthGuard],
    data: { navbar: true },
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
  }, {
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
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', component: NotFoundComponent },
];
