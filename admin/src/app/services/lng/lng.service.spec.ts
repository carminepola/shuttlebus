import { TestBed } from '@angular/core/testing';

import { LngService } from './lng.service';

describe('LngService', () => {
  let service: LngService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LngService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
