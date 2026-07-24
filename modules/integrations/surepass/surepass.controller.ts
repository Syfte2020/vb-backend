import {
  Controller,
  Get,
  UseGuards,
  Param,
  Put,
  Req,
  Patch,
  Post,
  Body,
  Query,
  Delete,
  Res,
  Headers
} from '@nestjs/common';
import type { FastifyRequest , FastifyReply } from 'fastify';


import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';

import { SurepassService } from './surepass.service';

@Controller('thirdParty')
export class SurepassController {
  constructor(private readonly surepassService: SurepassService) {}

    @UseGuards(JwtAuthGuard)
 @Post('verifyPAN')
pan_verify(@Body() body: string,@CurrentUser() user: any,@Headers('x-category') category:any , @Headers('x-country') country:any) {
  return this.surepassService.verifyPan(body, user?.id,category,country );
}
 @UseGuards(JwtAuthGuard)
 @Post('verifyGST')
verifyGST(@Body() body: string,@CurrentUser() user: any) {
  return this.surepassService.verifyGST(body,user?.id);
}  
@UseGuards(JwtAuthGuard)
 @Post('verifyBank')
verifyBank(@Body() body: string,@CurrentUser() user: any,@Headers('x-category') category:any , @Headers('x-country') country:any) {
  return this.surepassService.verifyBank(body,user?.id,category,country);
} 

@Post('verifyAdhar')
verifyAdhar(@Body() body: string) {
  return this.surepassService.verifyAdhar(body);
}
// @Post('digilocker/callback')
// callback(@Body() body: string) {
//   return this.surepassService.callback(body);
// }

// @Get('digilocker/callback')
// async callback(@Query() query, @Res() res) {
//   console.log(query); // <-- Is this getting called?

//   // Save data...

 
//   return res.redirect(
//   `https://venuebook-psi.vercel.app/vendor/kyc/success`,
// );
// }

 @Get('digilocker/callback')
  async callback(
    @Query() query: any,
     @Res() reply: FastifyReply,
  ) {
    await this.surepassService.handleCallback(query);

    return reply
      .type('text/html')
      .send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>DigiLocker Success</title>
          </head>
          <body style="font-family:Arial;text-align:center;padding-top:100px">
            <h2>✅ DigiLocker Verification Successful</h2>
            <p>You can close this window now.</p>

            <script>
              setTimeout(() => {
                window.close();
              }, 3000);
            </script>
          </body>
        </html>
      `);
  }

  @Post('digilocker/webhook')
  async webhook(@Body() body: any ,@Headers('x-category') category:any , @Headers('x-country') country:any) {
    await this.surepassService.handleWebhook(body,category,country);

    return {
      success: true,
    };
  }

@Get('initializeDigilocker')
initializeDigilocker(@Body() body: string) {
  return this.surepassService.verifyAdhar(body);
}
 @UseGuards(JwtAuthGuard)
@Post('UploadDocument')
async UploadDocument(
  @Req() req: FastifyRequest,
  @CurrentUser() user: any,
) {
  try {
    const parts = req.parts();

    const body: any = {};
    let document: any = null;

    for await (const part of parts) {
      /*
      |--------------------------------------------------------------------------
      | FILE
      |--------------------------------------------------------------------------
      */
      if (part.type === 'file') {
        if (!part.filename) {
          continue;
        }

        const buffer = await part.toBuffer();

        if (!buffer || buffer.length === 0) {
          continue;
        }

        const fileData = {
          buffer,
          filename: part.filename,
          mimetype: part.mimetype,
        };

        if (part.fieldname === 'file') {
          document = fileData;
        }
      }

      /*
      |--------------------------------------------------------------------------
      | FIELDS
      |--------------------------------------------------------------------------
      */
      if (part.type === 'field') {
        body[part.fieldname] = String(part.value);
      }
    }

    return await this.surepassService.UploadDocument(
      document,
      body,
      user?.id,
    );
  } catch (error) {
    console.error(error);

  }
}
}
