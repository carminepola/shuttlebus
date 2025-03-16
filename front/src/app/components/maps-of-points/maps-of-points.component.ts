import { Component, OnInit } from '@angular/core';
import { GoogleMapsModule } from '@angular/google-maps';
import { StopsService } from '../../services/stops/stops.service';
import { lastValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-maps-of-points',
  standalone: true,
  imports: [GoogleMapsModule, CommonModule],
  templateUrl: './maps-of-points.component.html',
  styleUrl: './maps-of-points.component.scss',
})
export class MapsOfPointsComponent implements OnInit {
  center: google.maps.LatLngLiteral = { lat: 40.74894, lng: 14.50349 }; // es. Roma
  zoom = 10;
  stops: string[] = [];
  public markers: google.maps.LatLngLiteral[] = [];
  constructor(private stopsService: StopsService) {}

  async ngOnInit(): Promise<void> {
    try {
      let stops = await lastValueFrom(this.stopsService.getAllActiveStops());

      if (stops.stops && stops.stops.length > 0) {
        this.markers = stops.stops.map((stop: any) => ({
          lat: stop.location.latitude,
          lng: stop.location.longitude,
        }));

        console.log(this.markers); // Verifica i markers
      }
    } catch (error) {
      console.error('Errore recupero stops', error);
    }
  }
}
