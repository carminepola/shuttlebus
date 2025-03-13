import { Pipe, PipeTransform } from '@angular/core';
@Pipe({
  name: 'filterDate',
})
export class filterDatePipe implements PipeTransform {
  transform(date: string): any {
    let d = new Date(date);
    let day = ('0' + d.getDate()).slice(-2);
    let month = ('0' + (d.getMonth() + 1)).slice(-2);
    let year = d.getFullYear();
    return day + '-' + month + '-' + year;
  }
}
