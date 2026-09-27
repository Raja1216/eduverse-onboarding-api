import { IsOptional, IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\d{10,15}$/, { message: 'mobile must contain 10 to 15 digits' })
  mobile: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{1,4}$/, { message: 'mobilePrefix must be a valid country code' })
  mobilePrefix?: string = '+91';

  @IsString()
  @Matches(/^\d{4,9}$/, { message: 'otp must contain 4 to 9 digits' })
  otp: string;
}
