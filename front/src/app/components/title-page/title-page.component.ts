import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '../../pipe/translate.pipe';
@Component({
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  selector: 'app-title-page',
  templateUrl: './title-page.component.html',
  styleUrls: ['./title-page.component.scss'],
})
export class TitlePageComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() back = '';
  @Input() id = '';

  constructor(private titleService: Title, private metaService: Meta) {}

  ngOnInit(): void {
    let title = this.title;
    if (this.id != '' && title != '') {
      title = title + ' - ' + this.id;
    }
    this.titleService.setTitle(title || 'Admin Panel');
    this.metaService.updateTag({
      name: 'description',
      content: this.subtitle || 'Default Description',
    });
  }

  goBack(): void {
    window.history.back();
  }
}
