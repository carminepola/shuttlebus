import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ConfirmModalService, ConfirmModalConfig } from '../../services/confirm-modal/confirm-modal.service';

@Component({
  selector: 'app-confirm-modal',
  imports: [CommonModule],
  templateUrl: './confirm-modal.component.html',
  styleUrl: './confirm-modal.component.scss',
})
export class ConfirmModalComponent implements OnInit, OnDestroy {
  config: ConfirmModalConfig | null = null;
  private sub: Subscription | null = null;

  constructor(private confirmModalService: ConfirmModalService) {}

  ngOnInit(): void {
    this.sub = this.confirmModalService.config$.subscribe((config) => {
      this.config = config;
    });
  }

  ngOnDestroy(): void {
    if (this.sub) {
      this.sub.unsubscribe();
    }
  }

  onConfirm(): void {
    this.confirmModalService.confirm();
  }

  onCancel(): void {
    this.confirmModalService.cancel();
  }
}
