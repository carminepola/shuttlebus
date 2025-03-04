import { Component, OnInit, AfterViewInit } from '@angular/core';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { lastValueFrom } from 'rxjs';
import { StopsService } from '../../services/stops/stops.service';
import { RoutesService } from '../../services/routes/routes.service';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule, NgForm, ReactiveFormsModule } from '@angular/forms';
import { TicketTypeService } from '../../services/ticket-type/ticket-type.service';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { FooterComponent } from '../../components/footer/footer.component';

@Component({
  selector: 'app-riepilogo',
  imports: [
    LoadingComponent,
    TranslatePipe,
    TranslateNamePipe,
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    FooterComponent,
  ],
  templateUrl: './riepilogo.component.html',
  styleUrl: './riepilogo.component.scss',
})
export class RiepilogoComponent implements OnInit {
  constructor(private route: ActivatedRoute, private router: Router) {}

  public loading: boolean = true;
  public param: any = {};
  ngOnInit() {
    const navigation = window.history.state;
    if (navigation.value) {
      this.param = navigation.value;
      this.loading = false;
    } else {
      this.router.navigate(['/']);
    }
  }
}
