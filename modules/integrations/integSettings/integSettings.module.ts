import { Module } from '@nestjs/common';
import { IntegrationService } from './integSettings.service';


@Module({
  // controllers: [SurepassController],
  providers: [IntegrationService],
   exports: [IntegrationService],
})
export class IntegSettingsModule {}
