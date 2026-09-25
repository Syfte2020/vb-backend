import { Test, TestingModule } from '@nestjs/testing';
import { VenueListingService } from './venue-listing.service';

describe('VenueListingService', () => {
  let service: VenueListingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VenueListingService],
    }).compile();

    service = module.get<VenueListingService>(VenueListingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
