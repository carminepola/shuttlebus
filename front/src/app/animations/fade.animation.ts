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

export const slideAnimation = trigger('slideInOut', [
    transition(':enter', [
        style({ transform: 'translateX(100%)' }),
        animate('250ms ease-out', style({ transform: 'translateX(0)' })),
    ]),
    transition(':leave', [
        animate('200ms ease-in', style({ transform: 'translateX(100%)' })),
    ]),
]);
