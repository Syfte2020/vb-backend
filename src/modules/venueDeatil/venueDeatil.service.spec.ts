import { Test, TestingModule } from '@nestjs/testing';
import { VenueDetailService } from './venueDeatil.service';

describe('VenueDetailService', () => {
  let service: VenueDetailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VenueDetailService],
    }).compile();

    service = module.get<VenueDetailService>(VenueDetailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
