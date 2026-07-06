import {
  ActivatedRouteSnapshot,
  UrlSegment,
  UrlMatcher,
} from '@angular/router';

export const langMatcher: UrlMatcher = (segments) => {
  const supportedLngs = ['it', 'en', 'fr', 'de', 'es', 'jp'];
  if (segments.length === 0) return null;
  const first = segments[0].path;
  if (supportedLngs.includes(first)) {
    return { consumed: segments.slice(0, 1), posParams: { lang: new UrlSegment(first, {}) } };
  }
  return null;
};

export function getLangFromRoute(snapshot: ActivatedRouteSnapshot): string {
  let current = snapshot;
  while (current) {
    if (current.paramMap.has('lang')) {
      return current.paramMap.get('lang')!;
    }
    current = current.firstChild!;
  }
  return '';
}
