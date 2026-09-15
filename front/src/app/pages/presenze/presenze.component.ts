import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { AttendanceService } from '../../services/attendance/attendance.service';
import * as XLSX from 'xlsx';

const MONTHS = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

const WEEKDAY_LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

const CODES = ['D', 'S', 'F', 'M'];

const HOURS_PER_SHIFT = 8;

interface AttendanceRow {
  id: string;
  name: string;
  days: Record<string, string>;
  codes: string[];
  saving: boolean;
  error: boolean;
}

@Component({
  selector: 'app-presenze',
  standalone: true,
  imports: [CommonModule, TitlePageComponent, LoadingComponent, FormsModule],
  templateUrl: './presenze.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './presenze.component.scss',
})
export class PresenzeComponent implements OnInit {
  constructor(private attendanceService: AttendanceService) {}

  ngOnInit(): void {
    const now = new Date();
    this.year = now.getFullYear();
    this.month = now.getMonth() + 1;
    this.caricaPresenze();
  }

  years: number[] = (() => {
    const current = new Date().getFullYear();
    const years: number[] = [];
    for (let y = current - 2; y <= current + 1; y++) years.push(y);
    return years;
  })();

  months = MONTHS;
  availableCodes = CODES;
  hoursPerShift = HOURS_PER_SHIFT;

  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;

  rows: AttendanceRow[] = [];
  loading = true;
  savingAll = false;

  nuovaPersona = '';

  get daysInMonth(): number {
    return new Date(this.year, this.month, 0).getDate();
  }

  get dayNumbers(): number[] {
    return Array.from({ length: this.daysInMonth }, (_, i) => i + 1);
  }

  weekdayLetter(day: number): string {
    return WEEKDAY_LETTERS[(new Date(this.year, this.month - 1, day).getDay() + 6) % 7];
  }

  isWeekend(day: number): boolean {
    const idx = (new Date(this.year, this.month - 1, day).getDay() + 6) % 7;
    return idx >= 5;
  }

  caricaPresenze() {
    this.loading = true;
    this.attendanceService.getByMonth(this.year, this.month).subscribe({
      next: (res) => {
        const attendances = res?.attendances || [];
        this.rows = attendances.map((a: any) => this.toRow(a));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private toRow(a: any): AttendanceRow {
    const days = a.days || {};
    const codes = Array.from({ length: this.daysInMonth }, (_, i) => days[String(i + 1)] || '');
    return { id: a.id, name: a.name, days, codes, saving: false, error: false };
  }

  onPeriodChange() {
    this.caricaPresenze();
  }

  aggiungiPersona() {
    const name = this.nuovaPersona.trim();
    if (!name) return;
    if (this.rows.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      alert('Persona già presente in questo mese');
      return;
    }
    this.attendanceService.addPerson(this.year, this.month, name).subscribe({
      next: (res) => {
        this.rows.push({
          id: res.id,
          name,
          days: {},
          codes: Array.from({ length: this.daysInMonth }, () => ''),
          saving: false,
          error: false,
        });
        this.rows.sort((a, b) => a.name.localeCompare(b.name));
        this.nuovaPersona = '';
      },
      error: () => alert('Errore durante l\'aggiunta della persona'),
    });
  }

  rimuoviPersona(row: AttendanceRow) {
    if (!confirm(`Rimuovere ${row.name} dal foglio presenze? Lo storico di questo mese verrà eliminato.`)) {
      return;
    }
    this.attendanceService.delete(row.id).subscribe({
      next: () => {
        this.rows = this.rows.filter((r) => r.id !== row.id);
      },
      error: () => alert('Errore durante la rimozione'),
    });
  }

  onCodeChange(row: AttendanceRow, day: number) {
    const value = row.codes[day - 1] || '';
    if (value) {
      row.days[String(day)] = value;
    } else {
      delete row.days[String(day)];
    }
    this.salvaRiga(row);
  }

  onNameChange(row: AttendanceRow) {
    if (!row.name.trim()) {
      this.caricaPresenze();
      return;
    }
    this.salvaRiga(row);
  }

  salvaRiga(row: AttendanceRow) {
    row.saving = true;
    row.error = false;
    this.attendanceService.update(row.id, row.name.trim(), { ...row.days }).subscribe({
      next: () => {
        row.saving = false;
      },
      error: () => {
        row.saving = false;
        row.error = true;
      },
    });
  }

  countCode(row: AttendanceRow, code: string): number {
    return row.codes.filter((c) => c === code).length;
  }

  oreLavorate(row: AttendanceRow): number {
    return (this.countCode(row, 'D') + this.countCode(row, 'S')) * this.hoursPerShift;
  }

  codeClass(code: string): string {
    return code ? 'code-' + code : '';
  }

  esportaExcel() {
    const days = this.daysInMonth;
    const lastDayCol = XLSX.utils.encode_col(days);
    const colD = XLSX.utils.encode_col(days + 1);
    const colS = XLSX.utils.encode_col(days + 2);
    const colF = XLSX.utils.encode_col(days + 3);
    const colM = XLSX.utils.encode_col(days + 4);
    const colOre = XLSX.utils.encode_col(days + 5);

    const header: any[] = ['Dipendente'];
    for (let d = 1; d <= days; d++) header.push(d);
    header.push('D', 'S', 'F', 'M', 'ORE LAVORATE');

    const aoa: any[][] = [header];
    for (const row of this.rows) {
      const line: any[] = [row.name];
      for (const code of row.codes) line.push(code || '');
      for (let i = 0; i < 5; i++) line.push('');
      aoa.push(line);
    }

    const totals: any[] = ['TOTALE'];
    for (let i = 0; i < days + 5; i++) totals.push('');
    totals.push('');
    aoa.push(totals);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    this.rows.forEach((row, i) => {
      const r = i + 1;
      const dayRange = `B${r + 1}:${lastDayCol}${r + 1}`;
      ws[`${colD}${r + 1}`] = { t: 'n', f: `COUNTIF(${dayRange},"D")`, v: this.countCode(row, 'D') };
      ws[`${colS}${r + 1}`] = { t: 'n', f: `COUNTIF(${dayRange},"S")`, v: this.countCode(row, 'S') };
      ws[`${colF}${r + 1}`] = { t: 'n', f: `COUNTIF(${dayRange},"F")`, v: this.countCode(row, 'F') };
      ws[`${colM}${r + 1}`] = { t: 'n', f: `COUNTIF(${dayRange},"M")`, v: this.countCode(row, 'M') };
      ws[`${colOre}${r + 1}`] = {
        t: 'n',
        f: `(${colD}${r + 1}+${colS}${r + 1})*${this.hoursPerShift}`,
        v: this.oreLavorate(row),
      };
    });

    if (this.rows.length > 0) {
      const firstDataRow = 2;
      const lastDataRow = this.rows.length + 1;
      const totalRow = lastDataRow + 1;
      for (const col of [colD, colS, colF, colM]) {
        ws[`${col}${totalRow}`] = {
          t: 'n',
          f: `SUM(${col}${firstDataRow}:${col}${lastDataRow})`,
        };
      }
      ws[`${colOre}${totalRow}`] = {
        t: 'n',
        f: `SUM(${colOre}${firstDataRow}:${colOre}${lastDataRow})`,
      };
    }

    ws['!cols'] = [
      { wch: 24 },
      ...Array.from({ length: days }, () => ({ wch: 4.5 })),
      { wch: 5 },
      { wch: 5 },
      { wch: 5 },
      { wch: 5 },
      { wch: 14 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Presenze ${this.months[this.month - 1]} ${this.year}`.substring(0, 31));
    XLSX.writeFile(wb, `FoglioPresenze_${this.months[this.month - 1]}_${this.year}.xlsx`);
  }
}
