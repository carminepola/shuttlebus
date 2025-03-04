import { Pipe, PipeTransform } from '@angular/core';
import { ImagesService } from '../services/images/images.service';
@Pipe({
  name: 'images',
})
export class ImagesPipe implements PipeTransform {
  constructor(private imagesService: ImagesService) {}
  transform(value: any): string {
    return this.imagesService.get(value);
  }
}
