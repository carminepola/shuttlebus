import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
@Component({
  imports: [CommonModule],
  selector: 'app-title-page',
  templateUrl: './title-page.component.html',
  styleUrls: ['./title-page.component.scss']
})
export class TitlePageComponent {
  @Input() title = ''
  @Input() subtitle = ''
  @Input() back = ''

  constructor(private titleService: Title, private metaService: Meta) { }



  ngOnInit(): void {
    this.titleService.setTitle(this.title || 'Admin Panel');
    this.metaService.updateTag({ name: 'description', content: this.subtitle || 'Default Description' });
  }


  goBack(): void {
    window.history.back();
  }


}

