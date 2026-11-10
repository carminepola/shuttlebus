import { Pipe, PipeTransform } from '@angular/core';
import { LngService } from '../services/lng/lng.service';
@Pipe({
  name: 'translateName',
})
export class TranslateNamePipe implements PipeTransform {
  constructor(private lngService: LngService) {}
  transform(value: any): string {
    return this.lngService.pick(value);
  }
}
