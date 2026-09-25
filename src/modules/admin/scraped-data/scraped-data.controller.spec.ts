import { Test, TestingModule } from '@nestjs/testing';
import { VenueCategoryController } from './venue-category/venue-category.controller';

describe('VenueCategoryController', () => {
  let controller: VenueCategoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VenueCategoryController],
    }).compile();

    controller = module.get<VenueCategoryController>(VenueCategoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
