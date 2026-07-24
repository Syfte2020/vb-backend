import { Test, TestingModule } from '@nestjs/testing';
import { BecomeAHostPartnerController } from './become_a_host_partner.controller';

describe('BecomeAHostPartnerController', () => {
  let controller: BecomeAHostPartnerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BecomeAHostPartnerController],
    }).compile();

    controller = module.get<BecomeAHostPartnerController>(BecomeAHostPartnerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
