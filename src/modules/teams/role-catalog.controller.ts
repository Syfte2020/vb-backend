import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { RoleCatalogService } from './role-catalog.service';

@Controller('teams/:teamId/role-catalog')
export class RoleCatalogController {
  constructor(private readonly roleCatalogService: RoleCatalogService) {}

  @Get()
  async getCatalog(@Param('teamId', ParseIntPipe) teamId: number) {
    return this.roleCatalogService.getRoleCatalog(teamId);
  }
}