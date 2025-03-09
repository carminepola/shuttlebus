import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../pipe/translate.pipe';
@Component({
  selector: 'app-cookie-policy',
  imports: [TranslatePipe, CommonModule],
  templateUrl: './cookie-policy.component.html',
  styleUrl: './cookie-policy.component.scss',
})
export class CookiePolicyComponent implements OnInit {
  public show: boolean = false;
  constructor(private router: Router) {}

  ngOnInit(): void {
    this.show = localStorage.getItem('cookie') == 'true' ? false : true;
  }

  acceptCookies() {
    localStorage.setItem('cookie', 'true');
    this.show = false;
  }
  rejectCookies() {
    window.location.href = 'https://google.com';
  }
}
