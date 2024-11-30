import { ReactiveFormsModule } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
@Component({
  selector: 'app-lost-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule,RouterModule],
  templateUrl: './lost-password.component.html',
  styleUrls: ['./lost-password.component.scss']
})
export class LostPasswordComponent implements OnInit {

  lostPasswordForm!: FormGroup;
  formCode!: FormGroup;
  isLoading: boolean = false;
  codeSent: boolean = false;  // Corrected to 'codeSent'
  code:string ="";
  constructor(private formBuilder: FormBuilder, private router: Router) {}

  ngOnInit(): void {
    this.lostPasswordForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit(event: Event): void {
     
    event.stopPropagation();
    if (this.lostPasswordForm.invalid) {
      this.lostPasswordForm.markAllAsTouched();
    
      return;
    }
    this.isLoading = true;
    const email = this.lostPasswordForm.get('email')?.value;
    // TODO: Invia email con codice di verifica
    setTimeout(() => {
      this.codeSent = true;
      this.isLoading = false;
    }, 2000);
  }

  onSubmitCode(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    debugger
    if (this.code.length === 6) {
      this.isLoading = true;
      setTimeout(() => {
        this.isLoading = false;
        this.router.navigate(['/login']);
      
      }, 4000);
    
    }
  
   
    // TODO: Verifica codice di verifica
  }

  onInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (!value.trim().match(/^\d+$/)) {
      input.value = '';
      return;
    }
    if (value.length === 1) {
      this.code += value;
      const nextInput = document.querySelectorAll('input')[index + 1] as HTMLInputElement;
      nextInput?.focus();
    }
  }

  onKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace') {
      const input = event.target as HTMLInputElement;
      input.value = '';
      const prevInput = document.querySelectorAll('input')[index - 1] as HTMLInputElement;
      prevInput?.focus();
      this.code = this.code.slice(0, -1);
    }
  }

  onPaste(event: ClipboardEvent): void {
    const { clipboardData } = event;
    if(clipboardData){
      const text = clipboardData.getData('text/plain');
      const code = text.trim().split('').filter((c, i) => i < 6);
      const inputs = document.querySelectorAll('input');
      inputs.forEach((input, i) => {
        input.value = code[i] || '';
      });
      event.preventDefault();
    }
  
  }
}


