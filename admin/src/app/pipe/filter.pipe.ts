import { Pipe, PipeTransform } from '@angular/core';
@Pipe({
  name: 'filter',
})
export class FilterPipe implements PipeTransform {
  transform(items: any[], term: any): any {
    if (term === undefined || term === '') return items;

    return items.filter(function (item) {
      for (let key in item) {
        if (
          item[key] &&
          item[key].toString().toLowerCase().includes(term.toLowerCase())
        ) {
          return true;
        }
      }
      return false;
    });
  }
}
