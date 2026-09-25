import { Test, TestingModule } from '@nestjs/testing';
import { EventTagController } from './event-tag.controller';

describe('EventTagController', () => {
  let controller: EventTagController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventTagController],
    }).compile();

    controller = module.get<EventTagController>(EventTagController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
