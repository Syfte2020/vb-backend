import { Test, TestingModule } from '@nestjs/testing';
import { VenueListingController } from './venue-listing.controller';

describe('VenueListingController', () => {
  let controller: VenueListingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VenueListingController],
    }).compile();

    controller = module.get<VenueListingController>(VenueListingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
