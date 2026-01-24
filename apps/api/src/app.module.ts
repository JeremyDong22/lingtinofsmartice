// Root Application Module
// v1.0

import { Module } from '@nestjs/common';
import { AudioModule } from './modules/audio/audio.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ChatModule } from './modules/chat/chat.module';
import { SupabaseModule } from './common/supabase/supabase.module';

@Module({
  imports: [
    SupabaseModule,
    AudioModule,
    DashboardModule,
    ChatModule,
  ],
})
export class AppModule {}
