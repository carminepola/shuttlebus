import { Pipe, PipeTransform } from '@angular/core';
@Pipe({
  name: 'filter',
  pure: false,
})
export class FilterPipe implements PipeTransform {
  transform(items: any[], term: any): any {
    if (term === undefined || term === null || term === '') return items;

    // Remove extra spaces and split into words
    const searchWords = term
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((word: string) => word.length > 0);

    return items.filter(function (item: any) {
      for (let key in item) {
        if (item[key]) {
          const itemValue = item[key].toString().toLowerCase();

          // Check if any search word matches
          const matches = searchWords.some((word: string) => {
            // Check for exact word match or partial match
            return itemValue.includes(word);
          });

          if (matches) {
            return true;
          }
        }
      }
      return false;
    });
  }
}
