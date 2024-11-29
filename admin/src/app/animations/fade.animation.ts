import { animate, style, transition, trigger } from '@angular/animations';

export const fadeAnimation = trigger('fadeInOut', [
    transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('150ms ease-out', style({ opacity: 1, transform: 'scale(1)' })),
    ]),
    transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'scale(0.95)' })),
    ]),
]);
