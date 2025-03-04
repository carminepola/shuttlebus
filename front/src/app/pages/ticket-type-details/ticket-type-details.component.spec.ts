import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TicketTypeDetailsComponent } from './ticket-type-details.component';

describe('TicketTypeDetailsComponent', () => {
  let component: TicketTypeDetailsComponent;
  let fixture: ComponentFixture<TicketTypeDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketTypeDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TicketTypeDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
