import { Component, OnInit, OnDestroy } from '@angular/core';
import { GoogleMapsModule } from '@angular/google-maps';
import { StopsService } from '../../services/stops/stops.service';
import { lastValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MomapService } from '../../services/momap.service';

@Component({
  selector: 'app-maps-of-points',
  standalone: true,
  imports: [GoogleMapsModule, CommonModule],
  templateUrl: './maps-of-points.component.html',
  styleUrl: './maps-of-points.component.scss',
})
export class MapsOfPointsComponent implements OnInit, OnDestroy {
  center: google.maps.LatLngLiteral = { lat: 40.74894, lng: 14.50349 }; // es. Roma
  zoom = 10;
  stops: string[] = [];
  public markers: any[] = [];

  private intervalId: any;

  constructor(
    private stopsService: StopsService,
    private momapService: MomapService
  ) {}

  getArrowIcon(angle: number): string {
    // Normalizza l'angolo tra 0 e 360
    const normalizedAngle = ((angle % 360) + 360) % 360;

    // Ogni icona copre un intervallo di 22.5°
    const step = 360 / 16; // 22.5°
    const index = Math.round(normalizedAngle / step) % 16; // Trova l'indice tra 0 e 15

    return `https://earth.google.com/images/kml-icons/track-directional/track-${index}.png`;
  }
  async ngOnInit(): Promise<void> {
    try {
      let stops = await lastValueFrom(this.stopsService.getAllActiveStops());
      let momap = await lastValueFrom(this.momapService.getCurrent());

      if (stops.stops && stops.stops.length > 0) {
        this.markers = stops.stops.map((stop: any) => ({
          position: {
            lat: stop.location.latitude,
            lng: stop.location.longitude,
          },
        }));

        console.log(this.markers); // Verifica i markers
      }
      let stopMarkers = JSON.parse(JSON.stringify(this.markers));
      if (momap && momap.position.length > 0) {
        for (let i = 0; i < momap.position.length; i++) {
          let point = momap.position[i];
          this.markers.push({
            position: { lat: point.currentLat, lng: point.currentLng }, // Prima freccia
            bus: true,
            icon: {
              url: this.getArrowIcon(point.currentAngle), // Icona freccia
              scaledSize: new google.maps.Size(40, 40), // Dimensione
              anchor: new google.maps.Point(20, 20), // Punto di ancoraggio
              rotation: point.currentAngle, // Angolo di rotazione della freccia
            },
          });
          console.log(point);
        }
      }

      this.intervalId = setInterval(async () => {
        let momap = await lastValueFrom(this.momapService.getCurrent());
        this.markers = JSON.parse(JSON.stringify(stopMarkers));
        if (momap && momap.position.length > 0) {
          for (let i = 0; i < momap.position.length; i++) {
            let point = momap.position[i];
            this.markers.push({
              position: { lat: point.currentLat, lng: point.currentLng }, // Prima freccia
              bus: true,
              icon: {
                url: this.getArrowIcon(point.currentAngle), // Icona freccia
                scaledSize: new google.maps.Size(40, 40), // Dimensione
                anchor: new google.maps.Point(20, 20), // Punto di ancoraggio
                rotation: point.currentAngle, // Angolo di rotazione della freccia
              },
            });
            console.log(point);
          }
        }
      }, 60000);
    } catch (error) {
      console.error('Errore recupero stops', error);
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
  }
}
