import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { MyTicketsComponent } from './my-tickets.component';
import { LngService } from '../../services/lng/lng.service';

describe('MyTicketsComponent', () => {
  let component: MyTicketsComponent;
  let fixture: ComponentFixture<MyTicketsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyTicketsComponent, HttpClientTestingModule],
      providers: [{ provide: LngService, useValue: { traslate: (k: string) => k, getLng: () => 'it' } }],
    }).compileComponents();

    fixture = TestBed.createComponent(MyTicketsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('isPaid: true solo per confirmed + paid true (flag server)', () => {
    expect(component.isPaid({ status: 'confirmed', paid: true })).toBe(true);
    expect(component.isPaid({ status: 'confirmed', paid: false })).toBe(false);
    expect(component.isPaid({ status: 'confirmed' })).toBe(false);
    expect(component.isPaid({ status: 'pending', paid: false })).toBe(false);
  });

  it('generateQRCodes: nessun QR per booking non pagati', async () => {
    component.activeBookings = [
      { numberOfTickets: 'SBPAID01', status: 'confirmed', paid: true, date: '2099-01-01', createdAt: Date.now() },
      { numberOfTickets: 'SBNOTPAID01', status: 'confirmed', paid: false, date: '2099-01-01', createdAt: Date.now() },
      { numberOfTickets: 'SBPENDING01', status: 'pending', paid: false, date: '2099-01-01', createdAt: Date.now() },
    ];
    component.oldBookings = [];
    component.qrCodes = {};

    await component.generateQRCodes();

    expect(component.qrCodes['SBPAID01']).toBeTruthy();
    expect(component.qrCodes['SBNOTPAID01']).toBeUndefined();
    expect(component.qrCodes['SBPENDING01']).toBeUndefined();
  });

  it('statusBadgeLabel: confirmed non pagato mostra attesa conferma pagamento', () => {
    const label = component.statusBadgeLabel({ status: 'confirmed', paid: false });
    expect(label).toContain('conferma pagamento');
    expect(component.statusBadgeLabel({ status: 'confirmed', paid: true })).toBe('confirmed');
    expect(component.statusBadgeLabel({ status: 'pending', paid: false })).toBe('pending');
  });

  it('generatePDF: esce subito per booking non pagato', async () => {
    const consoleSpy = spyOn(console, 'error');
    const alertSpy = spyOn(window, 'alert');

    await component.generatePDF({ numberOfTickets: 'SBNOTPAID01', status: 'confirmed', paid: false });

    expect(alertSpy).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
