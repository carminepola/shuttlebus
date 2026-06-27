import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { FormsModule, NgForm } from '@angular/forms';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../services/user/user.service';
import { fadeAnimation } from '../../animations/fade.animation';

const ROLES = [
  { value: 50, label: 'Amministratore' },
  { value: 75, label: 'Autista' },
  { value: 100, label: 'Utente' },
  { value: 9999, label: 'Nessun permesso' },
];

@Component({
  selector: 'app-user-details',
  imports: [
    TitlePageComponent,
    FormsModule,
    LoadingComponent,
    CommonModule,
  ],
  animations: [fadeAnimation],
  templateUrl: './user-details.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './user-details.component.scss',
})
export class UserDetailsComponent implements OnInit {
  id: string = '';
  loading = true;
  saving = false;
  errorMessage = '';
  successMessage = '';

  roles = ROLES;

  form: any = {
    email: '',
    name: '',
    phone: '',
    password: '',
    role: 100,
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
  ) {}

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

  load(id: string): void {
    this.userService.getUserById(id).subscribe({
      next: (res: any) => {
        const user = res.user || res;
        this.form = {
          email: user.email || '',
          name: user.details?.name || '',
          phone: user.details?.phone || '',
          password: '',
          role: user.role || 100,
        };
        this.loading = false;
      },
      error: (e: any) => {
        this.loading = false;
        this.errorMessage = e?.error?.message || e?.message || 'Errore nel caricamento dell\'utente';
      },
    });
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) return;

    this.errorMessage = '';
    this.successMessage = '';
    this.saving = true;

    if (!this.id) {
      this.userService.createUser({
        email: this.form.email,
        password: this.form.password,
        name: this.form.name,
      }).subscribe({
        next: () => {
          this.saving = false;
          this.router.navigate(['/admin/utenti']);
        },
        error: (e: any) => {
          this.saving = false;
          this.errorMessage = e?.error?.message || e?.message || 'Errore durante la creazione';
        },
      });
    } else {
      this.userService.updateUserDetailsById(this.id, this.form.name, this.form.phone || undefined).subscribe({
        next: () => {
          if (this.form.password) {
            this.userService.changePassword(this.form.email, this.form.password, this.form.password).subscribe({
              next: () => {
                this.updateRoleAndFinish();
              },
              error: (e: any) => {
                this.saving = false;
                this.errorMessage = e?.error?.message || e?.message || 'Errore durante l\'aggiornamento della password';
              },
            });
          } else {
            this.updateRoleAndFinish();
          }
        },
        error: (e: any) => {
          this.saving = false;
          this.errorMessage = e?.error?.message || e?.message || 'Errore durante l\'aggiornamento';
        },
      });
    }
  }

  private updateRoleAndFinish(): void {
    this.userService.updateClientRole(this.id, this.form.role).subscribe({
      next: () => {
        this.saving = false;
        this.successMessage = 'Utente aggiornato con successo';
        setTimeout(() => {
          this.router.navigate(['/admin/utenti']);
        }, 1000);
      },
      error: (e: any) => {
        this.saving = false;
        this.errorMessage = e?.error?.message || e?.message || 'Errore durante l\'aggiornamento del ruolo';
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/utenti']);
  }

  get isEdit(): boolean {
    return !!this.id;
  }

  getTitle(): string {
    return this.isEdit ? 'Modifica utente' : 'Nuovo utente';
  }

  getSubtitle(): string {
    return this.isEdit ? 'Modifica i dati dell\'utente' : 'Crea un nuovo utente nel sistema';
  }
}
