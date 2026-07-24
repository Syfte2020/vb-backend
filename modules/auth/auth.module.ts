import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../../mail/mail.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { CommonModule } from '../../common/common.module';
import { SocketModule } from '../socket/socket.module';

@Module({
  providers: [AuthService,JwtStrategy],
  exports: [AuthService],
  controllers: [AuthController],
   imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secretKey',
      signOptions: { expiresIn: '3650d' },
    }),
    MailModule,
    CommonModule,
    SocketModule
  ],
})
export class AuthModule {}
