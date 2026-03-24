import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { FormsModule, ReactiveFormsModule, NgForm } from '@angular/forms';
import { LicensePlateService } from '../../services/licensePlate/license-plate.service';

@Component({
  selector: 'app-targhe',
  imports: [
    TitlePageComponent,
    LoadingComponent,
    FormsModule,
    ReactiveFormsModule,
  ],
  templateUrl: './targhe.component.html',
  styleUrl: './targhe.component.scss',
})
export class TargheComponent implements OnInit {
  constructor(
    private router: Router,
    private licensePlateService: LicensePlateService,
  ) {}

  ngOnInit(): void {
    this.caricaTarghe();
    this.caricaDispositiviMomap();
  }

  targhe: any[] = [];
  dispositiviMomap: any[] = [];
  loading: boolean = true;
  loadingDevices: boolean = true;

  nuovaTarga: any = {
    licensePlate: '',
    imei: '',
    name: '',
    enabled: true,
  };

  caricaTarghe() {
    this.licensePlateService.getAll().subscribe((res) => {
      if (res && res.licensePlates) {
        this.loading = false;
        this.targhe = res.licensePlates;
      }
    });
  }

  caricaDispositiviMomap() {
    this.licensePlateService.getMomapDevices().subscribe((res) => {
      if (res && res.devices) {
        this.loadingDevices = false;
        this.dispositiviMomap = res.devices;
        this.dispositiviMomap = this.dispositiviMomap.map((t) => {
          debugger;
          return {
            ...t,
            registrationNumber: JSON.parse(t.params).registrationNumber || '',
          };
        });
      }
    });
  }

  onDeviceChange(event: any, targaIndex?: number) {
    const selectedDevice = this.dispositiviMomap.find(
      (d) => d.imei === event.target.value,
    );
    if (selectedDevice) {
      // Popola automaticamente IMEI, nome e targa dal dispositivo
      if (targaIndex !== undefined) {
        // Modifica targa esistente
        this.targhe[targaIndex].imei = selectedDevice.imei;
        this.targhe[targaIndex].name = selectedDevice.name || '';
        // Se il dispositivo ha una targa (registrationNumber), usala
        if (selectedDevice.registrationNumber) {
          this.targhe[targaIndex].licensePlate =
            selectedDevice.registrationNumber;
        }
      } else {
        // Nuova targa
        this.nuovaTarga.imei = selectedDevice.imei;
        this.nuovaTarga.name = selectedDevice.name || '';
        // Se il dispositivo ha una targa (registrationNumber), usala
        if (selectedDevice.registrationNumber) {
          this.nuovaTarga.licensePlate = selectedDevice.registrationNumber;
        }
      }
    }
  }

  modificaTarga(
    id: string,
    licensePlate: string,
    imei: string,
    name: string,
    enabled: boolean,
  ) {
    let obj = {
      id,
      licensePlate,
      imei,
      name,
      enabled,
    };
    this.licensePlateService.patch(obj).subscribe((res) => {
      this.loading = true;
      if (res) {
        this.loading = false;
      }
    });
  }

  aggiungiTarga(licensePlate: string, imei: string, name: string) {
    this.licensePlateService
      .post({
        licensePlate,
        imei,
        name,
        enabled: true,
      })
      .subscribe((res) => {
        this.loading = true;
        if (res && res) {
          this.targhe.push({
            id: res.id,
            licensePlate,
            imei,
            name,
            enabled: true,
          });
          this.loading = false;
          // Reset form
          this.nuovaTarga = {
            licensePlate: '',
            imei: '',
            name: '',
            enabled: true,
          };
        }
      });
  }

  eliminaTarga(id: string) {
    if (confirm('Sei sicuro di voler eliminare questa targa?')) {
      this.licensePlateService.delete(id).subscribe((res) => {
        this.loading = true;
        if (res) {
          this.targhe = this.targhe.filter((t) => t.id !== id);

          this.loading = false;
        }
      });
    }
  }

  getDeviceName(imei: string): string {
    const device = this.dispositiviMomap.find((d) => d.imei === imei);
    return device ? device.name : imei;
  }
}
