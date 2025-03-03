import { Pipe, PipeTransform } from '@angular/core';
import { LngService } from '../services/lng/lng.service';
@Pipe({
  name: 'translateName',
})
export class TranslateNamePipe implements PipeTransform {
  constructor(private lngService: LngService) {}
  transform(value: any): string {
    let it: boolean = this.lngService.getLng() == 'it';
    return value.it && it ? value.it : value.en || value.it || '';
  }
}
