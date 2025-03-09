import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function matchValues(matchTo: string): ValidatorFn {
  return (control: any): ValidationErrors | null => {
    return control.parent &&
      control.parent.value &&
      control.value === control.parent.controls[matchTo].value
      ? null
      : { notMatching: true };
  };
}
