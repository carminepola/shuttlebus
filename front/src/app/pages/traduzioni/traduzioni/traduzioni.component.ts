import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TitlePageComponent } from '../../../components/title-page/title-page.component';
import { LoadingComponent } from '../../../components/loading/loading/loading.component';
import { FormsModule } from '@angular/forms';
import { LngService } from '../../../services/lng/lng.service';
import { Language, LanguagesService } from '../../../services/languages/languages.service';

/** Riga della collection lng: chiave + un testo per codice lingua. */
type Row = { id: string; txt: string; [code: string]: string };

@Component({
  selector: 'app-traduzioni',
  imports: [TitlePageComponent, RouterModule, LoadingComponent, FormsModule],
  templateUrl: './traduzioni.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './traduzioni.component.scss',
})
export class TraduzioniComponent implements OnInit {
  constructor(
    private lngService: LngService,
    private languagesService: LanguagesService,
  ) {}

  traduzioni: Row[] = [];
  loading = true;
  errorMessage = '';
  search = '';
  /** Lingua del filtro "solo da tradurre" ('' = nessun filtro). */
  missingIn = '';
  /** Lingue mostrate come colonne (tutte quelle configurate, attive o no). */
  visible = new Set<string>();
  pageSize = 50;
  /** Righe modificate e non ancora salvate. */
  dirty = new Set<string>();
  saving = new Set<string>();

  nuovaTraduzione: Record<string, string> = { txt: '' };

  /** Esempi di segnaposto mostrati nella guida (fuori dal template per non confondere Angular). */
  readonly hints = { company: '{{company}}', legal: '{{companyLegalName}}', variable: '{nome}', name: '{name}', pin: '{pin}' };

  get languages(): Language[] {
    return this.languagesService.all;
  }

  get visibleLanguages(): Language[] {
    return this.languages.filter((l) => this.visible.has(l.code));
  }

  ngOnInit(): void {
    this.visible = new Set(this.languages.map((l) => l.code));
    this.caricaTraduzioni();
  }

  toggleVisible(code: string) {
    if (this.visible.has(code) && this.visible.size > 1) this.visible.delete(code);
    else this.visible.add(code);
  }

  get filtered(): Row[] {
    const q = this.search.trim().toLowerCase();
    return this.traduzioni.filter((r) => {
      if (this.missingIn && (r[this.missingIn] || '').trim() !== '') return false;
      if (!q) return true;
      return r.txt.toLowerCase().includes(q) || this.languages.some((l) => (r[l.code] || '').toLowerCase().includes(q));
    });
  }

  get shown(): Row[] {
    return this.filtered.slice(0, this.pageSize);
  }

  /** Quante chiavi non hanno ancora il testo in quella lingua. */
  missingCount(code: string): number {
    return this.traduzioni.filter((r) => (r[code] || '').trim() === '').length;
  }

  caricaTraduzioni() {
    this.errorMessage = '';
    // elenco da modificare con i segnaposto ({{company}}): salvando restano tali
    this.lngService.get(true).subscribe({
      next: (res) => {
        this.loading = false;
        this.traduzioni = res?.lng || [];
        this.dirty.clear();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Errore nel caricamento delle traduzioni';
      },
    });
    // traduzioni in uso nell'app, con il nome dell'azienda gia' sostituito
    this.lngService.get().subscribe((res) => {
      if (res && res.lng) {
        this.lngService.setTranslations(res.lng);
      }
    });
  }

  /** Solo i testi per lingua (niente _id, txt, ...). */
  private texts(row: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const l of this.languages) out[l.code] = row[l.code] ?? '';
    return out;
  }

  salva(row: Row) {
    this.saving.add(row.id);
    this.lngService.patch({ id: row.id, ...this.texts(row) }).subscribe({
      next: () => {
        this.saving.delete(row.id);
        this.dirty.delete(row.id);
      },
      error: (e) => {
        this.saving.delete(row.id);
        this.errorMessage = e?.error?.message || 'Errore nel salvataggio di ' + row.txt;
      },
    });
  }

  aggiungi() {
    const txt = (this.nuovaTraduzione['txt'] || '').trim();
    if (!txt) {
      this.errorMessage = 'Inserisci la chiave della traduzione (es. str_benvenuto)';
      return;
    }
    if (this.traduzioni.some((r) => r.txt === txt)) {
      this.errorMessage = `La chiave ${txt} esiste già`;
      return;
    }
    this.loading = true;
    this.lngService.post({ txt, ...this.texts(this.nuovaTraduzione) }).subscribe({
      next: () => {
        this.nuovaTraduzione = { txt: '' };
        this.caricaTraduzioni();
      },
      error: (e) => {
        this.loading = false;
        this.errorMessage = e?.error?.message || 'Errore nella creazione della traduzione';
      },
    });
  }
}
