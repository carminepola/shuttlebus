import { Pipe, PipeTransform } from '@angular/core';
import { LngService } from '../services/lng/lng.service';
@Pipe({
  name: 'translate',
})
export class TranslatePipe implements PipeTransform {
  constructor(private lngService: LngService) {}
  transform(value: string): string {
    return this.lngService.traslate(value);
  }
}
