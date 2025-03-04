import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TicketsTypeComponent } from './tickets-type.component';

describe('TicketsTypeComponent', () => {
  let component: TicketsTypeComponent;
  let fixture: ComponentFixture<TicketsTypeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketsTypeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketsTypeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
