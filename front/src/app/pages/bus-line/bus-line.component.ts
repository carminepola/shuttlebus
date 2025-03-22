import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { FooterComponent } from '../../components/footer/footer.component';
import { StopsService } from '../../services/stops/stops.service';
import { RoutesService } from '../../services/routes/routes.service';
import { lastValueFrom } from 'rxjs';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';
import { ImagesService } from '../../services/images/images.service';
import { LngService } from '../../services/lng/lng.service';
@Component({
  selector: 'app-bus-line',
  imports: [
    TitlePageComponent,
    LoadingComponent,

    TranslatePipe,
    CommonModule,
    FooterComponent,
    TranslateNamePipe,
  ],
  templateUrl: './bus-line.component.html',
  styleUrl: './bus-line.component.scss',
})
export class BusLineComponent implements OnInit {
  public lineSelected: number = 0;
  public routes: any[] = [];
  public stops: any[] = [];
  async ngOnInit(): Promise<void> {
    debugger;
    let stops: any = await lastValueFrom(this.stopsService.getAllActiveStops());
    let route: any = await lastValueFrom(this.routesService.getRoutes());
    this.route.params.subscribe((params) => {
      this.lineSelected = parseInt(params['id']);
    });

    if (route) {
      this.routes = route.routes;
    }
    if (stops) {
      this.stops = stops.stops;
    }
    for (let j = 0; j < this.routes.length; j++) {
      this.routes[j];
      this.routes[j].schedules = this.routes[j].schedules.filter(
        (x: any) => x.status === 'active'
      );
      for (let i = 0; i < this.routes[j].stops.length; i++) {
        let stop = this.stops.find(
          (t: any) => t.id === this.routes[j].stops[i].id
        );
        this.routes[j].stops[i] = stop;
      }
    }
    this.routes = this.routes.filter((x) => x.enabled == true);

    let a = this.routes[this.lineSelected].name[this.lng.getLng()]
      .replace('-', 'to')
      .replace(/[^\w\s]|[\s]+/gi, '_');
    a = a
      .replace(/_{2,}/g, '_')

      .replace(/_$/, '')
      .trim();

    console.log(a);
    this.changePage(this.lineSelected);
  }

  public getUrl(name: string) {
    return this.imageService.get(name || '');
  }
  constructor(
    private location: Location,
    private stopsService: StopsService,
    private routesService: RoutesService,
    private route: ActivatedRoute,
    public imageService: ImagesService,
    private lng: LngService
  ) {}

  openMaps(lat: string, lng: string) {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    );
  }
  changePage(index: number) {
    this.lineSelected = index;
    let a = this.routes[this.lineSelected].name['en']
      .replace('-', 'to')
      .replace(/[^\w\s]|[\s]+/gi, '_');
    a = a
      .replace(/_{2,}/g, '_')

      .replace(/_$/, '')
      .trim();

    console.log(a);

    this.location.replaceState(`busLine/${this.lineSelected}/${a}`);
  }
}
