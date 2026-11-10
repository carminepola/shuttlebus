import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { Language, LanguagesService, LanguageSettings } from '../../services/languages/languages.service';
import { supportedLocale } from '../../services/lng/locale';
import { LngService } from '../../services/lng/lng.service';

const CODE_RE = /^[a-z]{2,3}(-[a-z0-9]{2,4})?$/;

@Component({
  selector: 'app-impostazioni-lingue',
  imports: [TitlePageComponent, FormsModule, RouterModule],
  templateUrl: './impostazioni-lingue.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ImpostazioniLingueComponent implements OnInit {
  languages: Language[] = [];
  defaultLanguage = '';
  nuova: Language = { code: '', name: '', flag: '', locale: '', enabled: false };
  salvando = false;
  messaggio = '';
  tipoMessaggio: 'success' | 'danger' = 'success';
  /** Chiavi di traduzione ancora vuote per lingua (dalle traduzioni caricate). */
  missing: Record<string, number> = {};
  private totalKeys = 0;

  constructor(
    private languagesService: LanguagesService,
    private lngService: LngService,
  ) {}

  ngOnInit() {
    this.reset(this.languagesService.current);
    this.lngService.get(true).subscribe({
      next: (res) => {
        const rows: any[] = res?.lng || [];
        this.totalKeys = rows.length;
        for (const l of this.languages) this.missing[l.code] = rows.filter((r) => !(r[l.code] || '').trim()).length;
      },
      error: () => {},
    });
  }

  private reset(s: LanguageSettings) {
    this.languages = s.languages.map((l) => ({ ...l }));
    this.defaultLanguage = s.defaultLanguage;
  }

  /** Date e numeri: se Angular non ha i dati del locale si usa l'inglese. */
  localeWarning(l: Language): boolean {
    const base = (l.locale || l.code).split('-')[0].toLowerCase();
    return supportedLocale(base) !== base;
  }

  move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= this.languages.length) return;
    [this.languages[i], this.languages[j]] = [this.languages[j], this.languages[i]];
  }

  remove(i: number) {
    if (this.languages[i].code === this.defaultLanguage) return;
    this.languages.splice(i, 1);
  }

  setDefault(code: string) {
    this.defaultLanguage = code;
    const l = this.languages.find((x) => x.code === code);
    if (l) l.enabled = true;
  }

  aggiungi() {
    const code = this.nuova.code.trim().toLowerCase();
    if (!CODE_RE.test(code) || code === 'id' || code === 'txt') return this.mostra('danger', 'Codice non valido: due o tre lettere minuscole, es. pt, nl, pt-br');
    if (this.languages.some((l) => l.code === code)) return this.mostra('danger', `La lingua ${code} esiste già`);
    if (!this.nuova.name.trim()) return this.mostra('danger', 'Inserisci il nome della lingua (es. Português)');
    this.languages.push({ ...this.nuova, code, name: this.nuova.name.trim(), locale: this.nuova.locale.trim() || code });
    this.missing[code] = this.totalKeys; // lingua nuova: nessun testo ancora
    this.nuova = { code: '', name: '', flag: '', locale: '', enabled: false };
    this.mostra('success', `Lingua ${code} aggiunta: salva, poi completa i testi in Traduzioni e attivala.`);
  }

  async salva() {
    this.salvando = true;
    try {
      const saved = await this.languagesService.save({ defaultLanguage: this.defaultLanguage, languages: this.languages });
      this.reset(saved);
      this.mostra('success', 'Lingue salvate. Gli utenti vedono le modifiche al prossimo caricamento della pagina.');
    } catch (e: any) {
      this.mostra('danger', e?.error?.message || 'Errore nel salvataggio delle lingue');
    }
    this.salvando = false;
  }

  private mostra(tipo: 'success' | 'danger', msg: string) {
    this.tipoMessaggio = tipo;
    this.messaggio = msg;
  }
}
