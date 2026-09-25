import { Test, TestingModule } from '@nestjs/testing';
import { PropertyTagService } from './property-tag.service';

describe('PropertyTagService', () => {
  let service: PropertyTagService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PropertyTagService],
    }).compile();

    service = module.get<PropertyTagService>(PropertyTagService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
