import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsEmail()
  email: string;

  /** 10-digit Indian mobile number, with or without a leading +91/91. */
  @IsString()
  @Matches(/^(?:\+?91)?[6-9]\d{9}$/, {
    message: 'contact must be a valid 10-digit Indian mobile number',
  })
  contact: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
