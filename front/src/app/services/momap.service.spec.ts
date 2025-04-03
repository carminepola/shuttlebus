import { TestBed } from '@angular/core/testing';

import { MomapService } from './momap.service';

describe('MomapService', () => {
  let service: MomapService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MomapService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
