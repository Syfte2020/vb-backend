import { Test, TestingModule } from '@nestjs/testing';
import { VenueCategoryService } from './venue-category.service';

describe('VenueCategoryService', () => {
  let service: VenueCategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VenueCategoryService],
    }).compile();

    service = module.get<VenueCategoryService>(VenueCategoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
