import { Type } from 'class-transformer';
import {
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(20)
  registrationToken: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  schoolId: number;

  @IsString()
  @MaxLength(30)
  classGrade: string;

  @IsString()
  @MaxLength(30)
  section: string;

  @IsString()
  @MaxLength(50)
  rollNo: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  confirmPassword: string;
}
