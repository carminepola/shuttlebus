import { Pipe, PipeTransform } from '@angular/core';
import { appLocale } from '../services/lng/locale';

/**
 * Prezzo in euro nel formato della lingua: 22 → "22 €", 12.5 → "12,50 €" (it),
 * "€12.50" (en). I centesimi compaiono solo se servono.
 * `price:false` restituisce solo il numero formattato, senza simbolo.
 */
@Pipe({ name: 'price', standalone: true })
export class PricePipe implements PipeTransform {
  private static formatters = new Map<string, Intl.NumberFormat>();

  transform(value: number | string | null | undefined, withSymbol = true): string {
    const n = Number(value);
    if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return '';
    const cents = Math.round(n * 100) % 100 !== 0;
    const key = `${withSymbol}|${cents}`;
    let f = PricePipe.formatters.get(key);
    if (!f) {
      f = new Intl.NumberFormat(appLocale(), {
        ...(withSymbol ? { style: 'currency', currency: 'EUR' } : {}),
        minimumFractionDigits: cents ? 2 : 0,
        maximumFractionDigits: 2,
      });
      PricePipe.formatters.set(key, f);
    }
    return f.format(n);
  }
}
