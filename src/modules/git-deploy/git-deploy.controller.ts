import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';

import { GitDeployService } from './git-deploy.service';

@Controller('admin/git')
export class GitDeployController {

  constructor(
    private readonly gitDeployService: GitDeployService,
  ) {}


  @Get('branches')
  async branches() {
    return this.gitDeployService.getBranches();
  }


  @Post('merge')
  async merge(
    @Body('branch') branch: string,
  ) {
    return this.gitDeployService.mergeToMain(
      branch,
    );
  }
}