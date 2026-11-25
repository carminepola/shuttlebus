import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/** Dati fiscali dell'emittente stampati sui biglietti (Admin -> Commercialista). */
export interface FiscalSettings {
  legalName: string;
  vatNumber: string;
  taxCode: string;
  address: string;
  vatRate: number;
  vatNote: string;
}

export interface FiscalAmounts {
  count: number;
  gross: number;
  taxable: number;
  vat: number;
  refundsCount: number;
  refunds: number;
  refundsTaxable: number;
  refundsVat: number;
  net: number;
  netTaxable: number;
  netVat: number;
}

export interface FiscalDay extends FiscalAmounts {
  date: string;
  firstCode: string;
  lastCode: string;
  byMethod: Record<string, number>;
}

export interface FiscalTicketRow {
  code: string;
  date: string;
  issuedAt: number;
  ticket: string;
  customer: string;
  route: string;
  travelDate: string;
  from: string;
  to: string;
  paymentMethod: string;
  vatRate: number;
  gross: number;
  taxable: number;
  vat: number;
  refunded: number;
  status: string;
}

export interface FiscalRefundRow {
  date: string;
  at: number;
  code: string;
  ticket: string;
  customer: string;
  paymentMethod: string;
  vatRate: number;
  amount: number;
  taxable: number;
  vat: number;
  full: boolean;
  description: string;
}

export interface FiscalReport {
  from: string;
  to: string;
  totals: FiscalAmounts;
  byMethod: Record<string, FiscalAmounts>;
  byVatRate: Record<string, FiscalAmounts>;
  days: FiscalDay[];
  tickets: FiscalTicketRow[];
  refunds: FiscalRefundRow[];
  settings: FiscalSettings;
  missingSettings: string[];
  firstIssuedAt: number | null;
  missingFiscal: number;
}

@Injectable({ providedIn: 'root' })
export class FiscalService {
  private apiUrl = environment.apiUrl + '/fiscal';

  constructor(private http: HttpClient) {}

  getSettings(): Observable<FiscalSettings> {
    return this.http.get<{ settings: FiscalSettings }>(this.apiUrl + '/settings').pipe(map((r) => r.settings));
  }

  patchSettings(data: Partial<FiscalSettings>): Observable<any> {
    return this.http.patch(this.apiUrl + '/settings', data);
  }

  report(from: string, to: string): Observable<FiscalReport> {
    return this.http.get<FiscalReport>(this.apiUrl + '/report', { params: { from, to } });
  }
}
