import { Module } from '@nestjs/common';
import { AuthController } from './admin_auth.controller';
import { AuthService } from './admin_auth.service';

import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  controllers: [AuthController],
  providers: [AuthService,JwtStrategy],
   exports: [AuthService],
   imports: [
    JwtModule.register({
      secret: 'secretKey',
      signOptions: { expiresIn: '3650d' },
    }),
  ]
})
export class AuthAdminModule {}
