import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NuovaCorsaComponent } from './nuova-corsa.component';

describe('NuovaCorsaComponent', () => {
  let component: NuovaCorsaComponent;
  let fixture: ComponentFixture<NuovaCorsaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NuovaCorsaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NuovaCorsaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
