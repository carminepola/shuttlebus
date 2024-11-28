import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';
import { AuthGuard } from './guard/auth.guard';
import { HomeComponent } from './pages/home/home.component';
import { ImpostazioniComponent } from './pages/impostazioni/impostazioni.component';
export const routes: Routes = [
  { path: 'login', component: LoginComponent, data: {} },
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard], data: { navbar: true } },
  { path: 'settings', component: ImpostazioniComponent, canActivate: [AuthGuard], data: { navbar: true } },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', component: NotFoundComponent }
];
