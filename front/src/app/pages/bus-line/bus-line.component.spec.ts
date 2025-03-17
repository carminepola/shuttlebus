import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BusLineComponent } from './bus-line.component';

describe('BusLineComponent', () => {
  let component: BusLineComponent;
  let fixture: ComponentFixture<BusLineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BusLineComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BusLineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
