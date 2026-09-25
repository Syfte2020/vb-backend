import { Test, TestingModule } from '@nestjs/testing';
import { PropertyTagController } from './property-tag.controller';

describe('PropertyTagController', () => {
  let controller: PropertyTagController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertyTagController],
    }).compile();

    controller = module.get<PropertyTagController>(PropertyTagController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
