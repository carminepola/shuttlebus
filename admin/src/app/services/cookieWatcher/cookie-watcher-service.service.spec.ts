import { TestBed } from '@angular/core/testing';

import { CookieWatcherServiceService } from './cookie-watcher-service.service';

describe('CookieWatcherServiceService', () => {
  let service: CookieWatcherServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CookieWatcherServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
