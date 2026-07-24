import { Test, TestingModule } from '@nestjs/testing';
import { listedVendorService } from './listed_vendor.service';

describe('VenueCategoryService', () => {
  let service: listedVendorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [listedVendorService],
    }).compile();

    service = module.get<VenueCategoryService>(listedVendorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
