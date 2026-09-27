import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Msg91Service } from './msg91.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, Msg91Service],
})
export class AuthModule {}
