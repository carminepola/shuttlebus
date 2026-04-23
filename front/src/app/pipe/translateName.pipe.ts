import { Pipe, PipeTransform } from '@angular/core';
import { LngService } from '../services/lng/lng.service';
@Pipe({
  name: 'translateName',
})
export class TranslateNamePipe implements PipeTransform {
  constructor(private lngService: LngService) {}
  transform(value: any): string {
    const lng = this.lngService.getLng();
    return value?.[lng] || value?.en || value?.it || '';
  }
}
