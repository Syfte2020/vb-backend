import { Test, TestingModule } from '@nestjs/testing';
import { EventTagService } from './event-tag.service';

describe('EventTagService', () => {
  let service: EventTagService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventTagService],
    }).compile();

    service = module.get<EventTagService>(EventTagService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
