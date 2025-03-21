import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TicketForRoutesComponent } from './ticket-for-routes.component';

describe('TicketForRoutesComponent', () => {
  let component: TicketForRoutesComponent;
  let fixture: ComponentFixture<TicketForRoutesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketForRoutesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TicketForRoutesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
