import { Test, TestingModule } from '@nestjs/testing';
import { ParentListingController } from './parent-listing.controller';

describe('ParentListingController', () => {
  let controller: ParentListingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParentListingController],
    }).compile();

    controller = module.get<ParentListingController>(ParentListingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
