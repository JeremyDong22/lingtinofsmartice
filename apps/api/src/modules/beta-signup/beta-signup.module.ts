// Beta Signup Module - Public registration for beta testing program

import { Module } from '@nestjs/common';
import { BetaSignupController } from './beta-signup.controller';
import { BetaSignupService } from './beta-signup.service';

@Module({
  controllers: [BetaSignupController],
  providers: [BetaSignupService],
})
export class BetaSignupModule {}
