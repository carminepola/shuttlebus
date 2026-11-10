import { Component, ChangeDetectionStrategy, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Language, LanguagesService } from '../../services/languages/languages.service';

/**
 * Testo multilingua ({ it: '...', en: '...' }) con un campo per ogni lingua
 * configurata (Impostazioni -> Lingue). La lingua predefinita e' obbligatoria se
 * `required`; le altre, se vuote, mostrano il testo della predefinita.
 *
 *   <app-multilang-input label="Nome" [(value)]="form.name" name="name" required />
 */
@Component({
  selector: 'app-multilang-input',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <fieldset class="multilang">
      <legend class="form-label mb-2">{{ label }}</legend>
      <div class="multilang-grid">
        @for (l of languages; track l.code) {
          <div>
            <label class="form-label small text-secondary mb-1" [for]="name + '_' + l.code">
              {{ l.flag }} {{ l.name }}
              @if (l.code === defaultLanguage && required) {
                <span class="text-danger">*</span>
              }
            </label>
            @if (multiline) {
              <textarea
                class="form-control"
                [id]="name + '_' + l.code"
                [name]="name + '_' + l.code"
                [rows]="rows"
                [required]="required && l.code === defaultLanguage"
                [ngModel]="value?.[l.code] || ''"
                (ngModelChange)="set(l.code, $event)"
              ></textarea>
            } @else {
              <input
                type="text"
                class="form-control"
                [id]="name + '_' + l.code"
                [name]="name + '_' + l.code"
                [required]="required && l.code === defaultLanguage"
                [ngModel]="value?.[l.code] || ''"
                (ngModelChange)="set(l.code, $event)"
              />
            }
          </div>
        }
      </div>
    </fieldset>
  `,
  styles: [
    `
      .multilang {
        border: 0;
        padding: 0;
        margin: 0;
        min-width: 0;
      }
      .multilang-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 0.5rem 0.75rem;
      }
    `,
  ],
})
export class MultilangInputComponent {
  @Input() label = '';
  /** Prefisso di id/name dei campi (unico nel form). */
  @Input() name = 'text';
  @Input() value: Record<string, string> | null | undefined = {};
  @Output() valueChange = new EventEmitter<Record<string, string>>();
  @Input({ transform: (v: any) => v !== false && v !== 'false' }) multiline = false;
  @Input() rows = 2;
  @Input({ transform: (v: any) => v !== false && v !== 'false' }) required = false;

  constructor(private languagesService: LanguagesService) {}

  /** Tutte le lingue configurate, anche disattivate: il testo e' pronto quando si attivano. */
  get languages(): Language[] {
    return this.languagesService.all;
  }

  get defaultLanguage(): string {
    return this.languagesService.defaultLanguage;
  }

  set(code: string, text: string) {
    this.value = { ...(this.value || {}), [code]: text };
    this.valueChange.emit(this.value);
  }
}
