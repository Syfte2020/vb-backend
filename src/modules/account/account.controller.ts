import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Req,
  Body,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import type { FastifyRequest } from 'fastify';
import { MultipartFile } from '@fastify/multipart';
import { AccountService } from './account.service';

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @UseGuards(JwtAuthGuard)
  @Get('loadProfileApi')
  loadProfileApi(@CurrentUser() user: any) {
    const userId = user?.id;
    return this.accountService.loadProfileApi(userId);
  } 
   @UseGuards(JwtAuthGuard)
  @Get('rewardsApi')
  rewardsApi(@CurrentUser() user: any) {
    const userId = user?.id;
    return this.accountService.rewardsApi(userId);
  }    
  
  @UseGuards(JwtAuthGuard)
  @Get('commercial_get')
  commercial_get(@CurrentUser() user: any) {
    const userId = user?.id;
    return this.accountService.commercial_get(userId);
  }   
  
  @UseGuards(JwtAuthGuard)
  @Get('notifications')
  notifications(@CurrentUser() user: any) {
    const userId = user?.id;
    return this.accountService.notifications(userId);
  } 
  
  // @UseGuards(JwtAuthGuard)
  // @Post('updateProfile')
  // updateProfile(@CurrentUser() user: any, @Body() body:any) {
  //   const userId = user?.id;
  //   return this.accountService.updateProfile(userId,body);
  // } 

// @UseGuards(JwtAuthGuard)
// @Post('updateProfile')
// async updateProfile(
//   @CurrentUser() user: any,
//   @Req() req: FastifyRequest,
// ) {
//   const parts = req.parts();

//   const body: any = {};
//   let avatar: any = null;

//   for await (const part of parts) {
//     if (part.type === 'file') {
//       avatar = part;
//     } else {
//       body[part.fieldname] = part.value;
//     }
//   }

//   return this.accountService.updateProfile(user.id, body, avatar);
// }
// @Post("updateProfile")
// @UseGuards(JwtAuthGuard)
// async updateProfile(
//   @CurrentUser() user: any,
//   @Req() req: FastifyRequest,
//   @Body() body: any,
// ) {
//   // JSON request
//   if (!req.isMultipart()) {
//     return this.accountService.updateProfile(
//       user.id,
//       body,
//     );
//   }

//   const parts = req.parts();

//   const data: any = {};
//   let avatar: MultipartFile | null = null;

//   for await (const part of parts) {
//     if (part.type === "file") {
//       if (part.fieldname === "avatar") {
//         avatar = part;
//       }
//     } else {
//       data[part.fieldname] = part.value;
//     }
//   }

//   return this.accountService.updateProfile(
//     user.id,
//     data,
//     avatar,
//   );
// }

@Post('updateProfile')
@UseGuards(JwtAuthGuard)
async updateProfile(
  @CurrentUser() user: any,
  @Req() req: FastifyRequest,
  @Body() body: any,
) {
  console.log('==============================');
  console.log('UPDATE PROFILE');
  console.log('METHOD:', req.method);
  console.log(
    'CONTENT TYPE:',
    req.headers['content-type'],
  );
  console.log(
    'IS MULTIPART:',
    req.isMultipart(),
  );
  console.log('==============================');

  /*
   * ==============================
   * JSON REQUEST
   * ==============================
   */
  if (!req.isMultipart()) {
    return this.accountService.updateProfile(
      user.id,
      body,
      null,
    );
  }

  /*
   * ==============================
   * MULTIPART REQUEST
   * ==============================
   */

  const data: Record<string, any> = {};

  let avatar: any = null;

  try {
    const parts = req.parts();

    for await (const part of parts) {
      /*
       * ==============================
       * FILE
       * ==============================
       */

      if (part.type === 'file') {
        console.log('FILE RECEIVED:', {
          fieldname: part.fieldname,
          filename: part.filename,
          mimetype: part.mimetype,
        });

        // Ignore empty file
        if (!part.filename) {
          continue;
        }

        /*
         * Convert stream to Buffer
         */
        const buffer = await part.toBuffer();

        console.log('FILE BUFFER:', {
          fieldname: part.fieldname,
          filename: part.filename,
          size: buffer?.length,
          isBuffer: Buffer.isBuffer(buffer),
        });

        if (
          !buffer ||
          !Buffer.isBuffer(buffer) ||
          buffer.length === 0
        ) {
          continue;
        }

        /*
         * Avatar
         */
        if (part.fieldname === 'avatar') {
          avatar = {
            fieldname: part.fieldname,
            originalname: part.filename,
            encoding: '7bit',
            mimetype: part.mimetype,
            buffer: buffer,
            size: buffer.length,
          };

          console.log(
            'AVATAR READY:',
            {
              filename: avatar.originalname,
              mimetype: avatar.mimetype,
              size: avatar.size,
            },
          );
        }

        continue;
      }

      /*
       * ==============================
       * FORM FIELD
       * ==============================
       */

      if (part.type === 'field') {
        data[part.fieldname] =
          String(part.value ?? '');

        console.log('FIELD RECEIVED:', {
          fieldname: part.fieldname,
          value: data[part.fieldname],
        });
      }
    }

    /*
     * ==============================
     * FINAL DATA
     * ==============================
     */

    console.log(
      'MULTIPART PARSING COMPLETED',
    );

    console.log('DATA:', data);

    console.log('AVATAR:', {
      exists: !!avatar,
      filename: avatar?.originalname,
      size: avatar?.size,
      mimetype: avatar?.mimetype,
    });

    /*
     * ==============================
     * SERVICE
     * ==============================
     */

    return this.accountService.updateProfile(
      user.id,
      data,
      avatar,
    );
  } catch (error) {
    console.error(
      'MULTIPART ERROR:',
      error,
    );

    throw error;
  }
}

@Post('send-email-verification')
@UseGuards(JwtAuthGuard)
  async sendVerification(
    @CurrentUser() user: any,
    @Body()
    body: {
      type: 'email' | 'phone';
      value: string;
    },
  ) {
    if (!body?.type) {
      throw new BadRequestException(
        'Verification type is required',
      );
    }

    if (!body?.value) {
      throw new BadRequestException(
        'Email or phone number is required',
      );
    }

    if (
      !['email', 'phone'].includes(body.type)
    ) {
      throw new BadRequestException(
        'Invalid verification type',
      );
    }

    return this.accountService.sendVerificationOtp(
      user.id,
      body.type,
      body.value,
    );
  }

  /**
   * ================================
   * VERIFY OTP
   * ================================
   */
  @Post('verify')
  @UseGuards(JwtAuthGuard)
  async verify(
    @CurrentUser() user: any,
    @Body()
    body: {
      type: 'email' | 'phone';
      value: string;
      otp: string;
    },
  ) {
    if (!body?.type) {
      throw new BadRequestException(
        'Verification type is required',
      );
    }

    if (!body?.value) {
      throw new BadRequestException(
        'Email or phone number is required',
      );
    }

    if (!body?.otp) {
      throw new BadRequestException(
        'OTP is required',
      );
    }

    return this.accountService.verifyOtp(
      user.id,
      body.type,
      body.value,
      body.otp,
    );
  }
  @Get('fiance_settlement')
  @UseGuards(JwtAuthGuard)
  async fiance_settlement(
    @CurrentUser() user: any,
  ) {
     return this.accountService.fiance_settlement(
      user.id
    );

  }
  
}
