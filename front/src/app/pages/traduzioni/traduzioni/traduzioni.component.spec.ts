import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TraduzioniComponent } from './traduzioni.component';

describe('TraduzioniComponent', () => {
  let component: TraduzioniComponent;
  let fixture: ComponentFixture<TraduzioniComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TraduzioniComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TraduzioniComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
