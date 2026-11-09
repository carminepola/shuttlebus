/**
 * Brand identity compilata nel front. I valori arrivano da brands/<brand>/brand.json:
 * scripts/apply-brand.mjs genera src/brand/brand.ts (non versionato) prima di
 * start/build. Non scrivere nomi, contatti o colori del brand nel codice: usa BRAND.
 */
export type Rgb = [number, number, number];
export type Palette = Record<'50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | '950', string>;

export interface BrandSeoTexts {
  title: string;
  description: string;
  homeKeywords: string;
  pageKeywords: string;
}

export interface Brand {
  id: string;
  name: string;
  documentTitle: string;
  legalName: string;
  pdfTitle: string;
  siteUrl: string;
  manifestDescription: string;
  colors: {
    theme: string;
    background: string;
    primaryShade: number;
    secondaryShade: number;
    primary: Palette;
    secondary: Palette;
    /** Colori con un ruolo specifico (map-marker, highlight, ...): vedi EXTRA_COLORS in scripts/apply-brand.mjs. */
    extra: Record<'map-marker' | 'highlight' | 'secondary-hover' | 'icon', string>;
  };
  contacts: {
    phone?: { label: string; href: string };
    email?: string;
    whatsapp?: { label: string; href: string };
  };
  social: { facebook?: string; instagram?: string };
  companyInfo: string[][];
  images: { aboutAlt: string; busStatus: string };
  seo: { homeTitle: string; it: BrandSeoTexts; en: BrandSeoTexts };
}

/** Percorso pubblico degli asset del brand (logo usato anche dalle mail del back-end). */
export const BRAND_ASSETS = '/assets/brand';

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
