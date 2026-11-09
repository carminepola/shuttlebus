import { BRAND } from './brand';
import { BRAND_ASSETS, hexToRgb, Rgb } from './brand.model';

export { BRAND } from './brand';
export { BRAND_ASSETS, hexToRgb, rgba } from './brand.model';
export type { Brand, Rgb } from './brand.model';

/** Colore principale del brand (stessa tonalita' di $primary / --brand-primary). */
export const BRAND_PRIMARY: string = (BRAND.colors.primary as Record<string, string>)[String(BRAND.colors.primaryShade)];
/** Colore secondario del brand (stessa tonalita' di $secondary / --brand-secondary). */
export const BRAND_SECONDARY: string = (BRAND.colors.secondary as Record<string, string>)[String(BRAND.colors.secondaryShade)];

export const BRAND_LOGO = `${BRAND_ASSETS}/logo.png`;

export function brandRgb(palette: 'primary' | 'secondary', shade: string): Rgb {
  return hexToRgb((BRAND.colors[palette] as Record<string, string>)[shade]);
}

/** Oggetto per i template: `readonly brand = BRAND_VIEW;` e poi brand.logo, brand.name, ... */
export const BRAND_VIEW = { ...BRAND, logo: BRAND_LOGO, assets: BRAND_ASSETS };
