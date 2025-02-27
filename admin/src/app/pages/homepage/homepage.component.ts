import { Component } from '@angular/core';
import { fadeAnimation } from '../../animations/fade.animation';
import { FooterComponent } from '../../components/footer/footer.component';
import { LngService } from '../../services/lng/lng.service';
import { CommonModule } from '@angular/common'; 
 
@Component({
  selector: 'app-homepage',
  imports: [FooterComponent, CommonModule],
  animations: [fadeAnimation],
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.scss',
})
export class HomepageComponent {
  traduci(id:string){
    return this.lngService.traslate(id);
  }

  constructor(private lngService:LngService){

  }
}
