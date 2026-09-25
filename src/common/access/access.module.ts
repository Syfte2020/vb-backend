import { Global, Module } from '@nestjs/common';
// import { AccessService } from './access.service';
import { PermissionsGuard } from './permissions.guard';

@Global() // available in every module without importing
@Module({
  providers: [ PermissionsGuard],
  exports: [ PermissionsGuard],
})
export class AccessModule {}