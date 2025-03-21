import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TicketCheckComponent } from './ticket-check.component';

describe('TicketCheckComponent', () => {
  let component: TicketCheckComponent;
  let fixture: ComponentFixture<TicketCheckComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketCheckComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TicketCheckComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
