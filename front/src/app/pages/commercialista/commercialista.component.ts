import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { FiscalAmounts, FiscalReport, FiscalService, FiscalSettings } from '../../services/fiscal/fiscal.service';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const METHOD_LABELS: Record<string, string> = { stripe: 'Carta (Stripe)', cash: 'Contanti / POS', other: 'Altro' };
const FIELD_LABELS: Record<string, string> = { legalName: 'ragione sociale', vatNumber: 'partita IVA', address: 'sede legale' };

/**
 * Area commercialista: dati fiscali stampati sui biglietti, riepilogo dei
 * corrispettivi del periodo (registro giornaliero, per metodo, per aliquota)
 * ed export Excel/CSV.
 */
@Component({
  selector: 'app-commercialista',
  imports: [CommonModule, FormsModule, TitlePageComponent, LoadingComponent],
  templateUrl: './commercialista.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './commercialista.component.scss',
})
export class CommercialistaComponent implements OnInit {
  from = '';
  to = '';
  report: FiscalReport | null = null;
  loading = true;
  error = '';

  settings: FiscalSettings | null = null;
  showSettings = false;
  saving = false;
  settingsMessage = '';
  settingsError = false;

  constructor(private fiscalService: FiscalService) {}

  async ngOnInit() {
    this.setPreset('thisMonth', false);
    await Promise.all([this.loadSettings(), this.load()]);
  }

  // ------------------------------------------------------------ periodo

  setPreset(preset: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'lastYear', reload = true) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let a: Date, b: Date;
    switch (preset) {
      case 'lastMonth':
        a = new Date(y, m - 1, 1);
        b = new Date(y, m, 0);
        break;
      case 'thisQuarter':
        a = new Date(y, Math.floor(m / 3) * 3, 1);
        b = new Date(y, Math.floor(m / 3) * 3 + 3, 0);
        break;
      case 'thisYear':
        a = new Date(y, 0, 1);
        b = new Date(y, 11, 31);
        break;
      case 'lastYear':
        a = new Date(y - 1, 0, 1);
        b = new Date(y - 1, 11, 31);
        break;
      default:
        a = new Date(y, m, 1);
        b = new Date(y, m + 1, 0);
    }
    this.from = iso(a);
    this.to = iso(b);
    if (reload) this.load();
  }

  async load() {
    if (!this.from || !this.to || this.from > this.to) {
      this.error = 'Periodo non valido';
      return;
    }
    this.loading = true;
    this.error = '';
    try {
      this.report = await lastValueFrom(this.fiscalService.report(this.from, this.to));
    } catch (err: any) {
      this.report = null;
      this.error = err?.error?.message || err?.message || 'Errore nel caricamento dei dati';
    }
    this.loading = false;
  }

  // ------------------------------------------------------------ impostazioni

  async loadSettings() {
    try {
      this.settings = await lastValueFrom(this.fiscalService.getSettings());
    } catch {
      this.settings = null;
    }
  }

  async saveSettings() {
    if (!this.settings) return;
    this.saving = true;
    this.settingsMessage = '';
    try {
      await lastValueFrom(
        this.fiscalService.patchSettings({
          legalName: this.settings.legalName,
          vatNumber: this.settings.vatNumber,
          taxCode: this.settings.taxCode,
          address: this.settings.address,
          vatRate: Number(this.settings.vatRate),
          vatNote: this.settings.vatNote,
        }),
      );
      this.settingsError = false;
      this.settingsMessage = 'Dati salvati: valgono per i biglietti emessi da ora in poi.';
      await Promise.all([this.loadSettings(), this.load()]);
    } catch (err: any) {
      this.settingsError = true;
      this.settingsMessage = 'Errore nel salvataggio: ' + (err?.error?.message || err?.message || 'errore sconosciuto');
    }
    this.saving = false;
  }

  // ------------------------------------------------------------ vista

  get missingLabels(): string {
    return (this.report?.missingSettings || []).map((k) => FIELD_LABELS[k] || k).join(', ');
  }

  methodLabel(m: string): string {
    return METHOD_LABELS[m] || m;
  }

  get methods(): { key: string; a: FiscalAmounts }[] {
    return Object.entries(this.report?.byMethod || {}).map(([key, a]) => ({ key, a }));
  }

  get rates(): { key: string; a: FiscalAmounts }[] {
    return Object.entries(this.report?.byVatRate || {})
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([key, a]) => ({ key, a }));
  }

  formatDate(d: string): string {
    const [y, m, g] = String(d || '').split('-');
    return g ? `${g}/${m}/${y}` : d;
  }

  private get periodLabel(): string {
    return `${this.from}_${this.to}`;
  }

  // ------------------------------------------------------------ export

  private sheets(): Record<string, (string | number)[][]> {
    const r = this.report!;
    const t = r.totals;
    const s = r.settings;
    const riepilogo: (string | number)[][] = [
      ['Riepilogo corrispettivi biglietti'],
      ['Emittente', s.legalName],
      ['Partita IVA', s.vatNumber],
      ['Codice fiscale', s.taxCode],
      ['Sede', s.address],
      ['Periodo', `${this.formatDate(r.from)} - ${this.formatDate(r.to)}`],
      [],
      ['Voce', 'Numero', 'Lordo', 'Imponibile', 'IVA'],
      ['Biglietti emessi', t.count, t.gross, t.taxable, t.vat],
      ['Rimborsi', t.refundsCount, -t.refunds, -t.refundsTaxable, -t.refundsVat],
      ['Netto', '', t.net, t.netTaxable, t.netVat],
      [],
      ['Per metodo di pagamento', 'Biglietti', 'Lordo', 'Rimborsi', 'Netto'],
      ...this.methods.map(({ key, a }) => [this.methodLabel(key), a.count, a.gross, a.refunds, a.net]),
      [],
      ['Per aliquota IVA', 'Biglietti', 'Imponibile netto', 'IVA netta', 'Totale netto'],
      ...this.rates.map(({ key, a }) => [`${key}%`, a.count, a.netTaxable, a.netVat, a.net]),
    ];
    const registro: (string | number)[][] = [
      ['Data', 'Biglietti', 'Dal n.', 'Al n.', 'Lordo', 'Imponibile', 'IVA', 'Rimborsi', 'Imponibile rimborsi', 'IVA rimborsi', 'Netto', 'Imponibile netto', 'IVA netta', 'Carta (Stripe)', 'Contanti / POS', 'Altro'],
      ...r.days.map((d) => [
        this.formatDate(d.date),
        d.count,
        d.firstCode,
        d.lastCode,
        d.gross,
        d.taxable,
        d.vat,
        d.refunds,
        d.refundsTaxable,
        d.refundsVat,
        d.net,
        d.netTaxable,
        d.netVat,
        d.byMethod['stripe'] || 0,
        d.byMethod['cash'] || 0,
        d.byMethod['other'] || 0,
      ]),
      ['Totale', t.count, '', '', t.gross, t.taxable, t.vat, t.refunds, t.refundsTaxable, t.refundsVat, t.net, t.netTaxable, t.netVat, r.byMethod['stripe']?.gross || 0, r.byMethod['cash']?.gross || 0, r.byMethod['other']?.gross || 0],
    ];
    const biglietti: (string | number)[][] = [
      ['N. documento', 'Data emissione', 'Ora', 'Codice biglietto', 'Cliente', 'Linea', 'Da', 'A', 'Data viaggio', 'Pagamento', 'Aliquota IVA %', 'Lordo', 'Imponibile', 'IVA', 'Rimborsato', 'Stato'],
      ...r.tickets.map((x) => [
        x.code,
        this.formatDate(x.date),
        new Date(x.issuedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        x.ticket,
        x.customer,
        x.route,
        x.from,
        x.to,
        this.formatDate(x.travelDate),
        this.methodLabel(x.paymentMethod),
        x.vatRate,
        x.gross,
        x.taxable,
        x.vat,
        x.refunded,
        x.status,
      ]),
    ];
    const rimborsi: (string | number)[][] = [
      ['Data rimborso', 'N. documento', 'Codice biglietto', 'Cliente', 'Pagamento', 'Tipo', 'Aliquota IVA %', 'Importo', 'Imponibile', 'IVA', 'Dettaglio'],
      ...r.refunds.map((x) => [
        this.formatDate(x.date),
        x.code,
        x.ticket,
        x.customer,
        this.methodLabel(x.paymentMethod),
        x.full ? 'Totale' : 'Parziale',
        x.vatRate,
        x.amount,
        x.taxable,
        x.vat,
        x.description,
      ]),
    ];
    return { Riepilogo: riepilogo, 'Registro giornaliero': registro, Biglietti: biglietti, Rimborsi: rimborsi };
  }

  exportExcel() {
    if (!this.report) return;
    const wb = XLSX.utils.book_new();
    for (const [name, rows] of Object.entries(this.sheets())) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
    }
    XLSX.writeFile(wb, `Corrispettivi_${this.periodLabel}.xlsx`);
  }

  /** CSV per Excel italiano: separatore ";", decimali con la virgola, UTF-8 con BOM. */
  exportCsv(sheet: 'Registro giornaliero' | 'Biglietti' | 'Rimborsi') {
    if (!this.report) return;
    const rows = this.sheets()[sheet];
    const cell = (v: string | number) => {
      const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = '\uFEFF' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sheet.replace(/\s+/g, '_')}_${this.periodLabel}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
