import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapsOfPointsComponent } from './maps-of-points.component';

describe('MapsOfPointsComponent', () => {
  let component: MapsOfPointsComponent;
  let fixture: ComponentFixture<MapsOfPointsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapsOfPointsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MapsOfPointsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
