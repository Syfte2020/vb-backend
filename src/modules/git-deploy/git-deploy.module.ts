import { Module } from '@nestjs/common';

import { GitDeployController } from './git-deploy.controller';
import { GitDeployService } from './git-deploy.service';

@Module({
  controllers: [
    GitDeployController,
  ],
  providers: [
    GitDeployService,
  ],
})
export class GitDeployModule {}