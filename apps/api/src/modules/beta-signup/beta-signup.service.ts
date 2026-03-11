// Beta Signup Service - DB operations for beta registration

import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';

interface BetaSignupData {
  brand: string;
  category: string;
  name: string;
  position: string;
  age?: number;
  phone: string;
  store_count?: string;
  annual_revenue?: string;
  city: string;
  help_text?: string;
}

@Injectable()
export class BetaSignupService {
  private readonly logger = new Logger(BetaSignupService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async create(data: BetaSignupData): Promise<{ id: string }> {
    const client = this.supabase.getClient();

    const { data: result, error } = await client
      .from('lingtin_beta_signups')
      .insert(data)
      .select('id')
      .single();

    if (error) {
      // Postgres 23505 = unique constraint violation (duplicate phone)
      if (error.code === '23505') {
        throw new ConflictException('该手机号已报名');
      }
      this.logger.error('Beta signup insert failed', error);
      throw error;
    }

    this.logger.log(`New beta signup: ${data.brand} - ${data.name}`);
    return { id: result.id };
  }
}
