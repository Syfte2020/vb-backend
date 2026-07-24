import { Test, TestingModule } from '@nestjs/testing';
import { BecomeAHostPartnerService } from './become_a_host_partner.service';

describe('BecomeAHostPartnerService', () => {
  let service: BecomeAHostPartnerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BecomeAHostPartnerService],
    }).compile();

    service = module.get<BecomeAHostPartnerService>(BecomeAHostPartnerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
