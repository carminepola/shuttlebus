import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../pipe/translate.pipe';

@Component({
  selector: 'app-step-indicator',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './step-indicator.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './step-indicator.component.scss',
})
export class StepIndicatorComponent {
  @Input() steps: string[] = [];
  @Input() current: number = 0;
}
