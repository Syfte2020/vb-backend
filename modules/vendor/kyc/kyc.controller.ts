import { Controller, Post, Req, UseGuards, Get, Headers } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { KycService } from './kyc.service';

import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}
  @Post('submit')
  @UseGuards(JwtAuthGuard)
  async submitKyc(@CurrentUser() user: any, @Req() req: FastifyRequest) {
    const parts = req.parts();

    const body: any = {};
    const files: any[] = []; // ✅ FIXED

    for await (const part of parts) {
      if (part.type === 'file') {
        const chunks: Buffer[] = [];

        for await (const chunk of part.file) {
          chunks.push(chunk);
        }

        files[part.fieldname] = {
          buffer: Buffer.concat(chunks),
          filename: part.filename,
          mimetype: part.mimetype,
        };
      } else {
        body[part.fieldname] = part.value;
      }
    }

    return this.kycService.updateKyc(user.id, body, files);
  }
  @Get('kyc_status')
  @UseGuards(JwtAuthGuard)
  async kyc_status(@CurrentUser() user: any,@Headers('x-category') category:any , @Headers('x-country') country:any) {
    return this.kycService.kyc_status(user.id,category,country);
  } 
  
  @Get('each_kyc_status')
  @UseGuards(JwtAuthGuard)
  async each_kyc_status(@CurrentUser() user: any,@Headers('x-category') category:any , @Headers('x-country') country:any) {
    return this.kycService.each_kyc_status(user.id,category,country);
  }
  
  @Get('suscription_detail')
  @UseGuards(JwtAuthGuard)
  async suscription_detail(@CurrentUser() user: any,@Headers('x-category') category:any , @Headers('x-country') country:any) {
    return this.kycService.suscription_detail(user.id,category,country);
  }
}
