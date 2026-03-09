import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';

const EMPTY_LATEST = { data: { batch_id: null, checked_at: null, checks: [], summary: { total: 0, ok: 0, fail: 0, timeout: 0 } } };

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get the latest patrol batch results (single query).
   */
  async getLatest() {
    const client = this.supabase.getClient();

    // Fetch recent patrol checks (max batch size ~20), determine batch from results
    const { data: recent, error } = await client
      .from('lingtin_health_checks')
      .select('*')
      .eq('check_type', 'patrol')
      .order('checked_at', { ascending: false })
      .limit(50);

    if (error || !recent?.length) {
      if (error) this.logger.error('Failed to fetch latest health checks', error);
      return EMPTY_LATEST;
    }

    // Extract latest batch
    const latestBatchId = recent[0].batch_id;
    const checks = recent.filter((c) => c.batch_id === latestBatchId);

    const summary = checks.reduce(
      (acc, c) => {
        acc.total++;
        if (c.status === 'ok') acc.ok++;
        else if (c.status === 'fail') acc.fail++;
        else if (c.status === 'timeout') acc.timeout++;
        return acc;
      },
      { total: 0, ok: 0, fail: 0, timeout: 0 },
    );

    return {
      data: {
        batch_id: latestBatchId,
        checked_at: checks[0]?.checked_at,
        checks,
        summary,
      },
    };
  }

  /**
   * Get patrol history grouped by batch for the last N days.
   */
  async getHistory(days: number = 7) {
    const client = this.supabase.getClient();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await client
      .from('lingtin_health_checks')
      .select('*')
      .eq('check_type', 'patrol')
      .gte('checked_at', since.toISOString())
      .order('checked_at', { ascending: false })
      .limit(500);

    if (error) {
      this.logger.error('Failed to fetch health history', error);
      return { data: [] };
    }

    // Group by batch_id with single-pass counting
    const batches = new Map<string, { batch_id: string; checked_at: string; total: number; ok: number; fail: number; timeout: number; checks: typeof data }>();

    for (const row of data) {
      if (!batches.has(row.batch_id)) {
        batches.set(row.batch_id, {
          batch_id: row.batch_id,
          checked_at: row.checked_at,
          total: 0,
          ok: 0,
          fail: 0,
          timeout: 0,
          checks: [],
        });
      }
      const batch = batches.get(row.batch_id)!;
      batch.total++;
      if (row.status === 'ok') batch.ok++;
      else if (row.status === 'fail') batch.fail++;
      else if (row.status === 'timeout') batch.timeout++;
      batch.checks.push(row);
    }

    return { data: Array.from(batches.values()) };
  }

  /**
   * Get current heartbeat status for all monitored endpoints.
   */
  async getHeartbeatStatus() {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('lingtin_health_status')
      .select('*')
      .order('endpoint');

    if (error) {
      this.logger.error('Failed to fetch health status', error);
      return { data: [] };
    }

    return { data };
  }

  async getLatestDigest() {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('lingtin_feedback_digests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        this.logger.error('Failed to fetch latest digest', error);
      }
      return { data: null };
    }

    return { data };
  }

  async getDigestHistory(days: number = 7) {
    const client = this.supabase.getClient();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await client
      .from('lingtin_feedback_digests')
      .select('id,created_at,trigger_feedback_id,total_pending,summary,priorities')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      this.logger.error('Failed to fetch digest history', error);
      return { data: [] };
    }

    return { data: data || [] };
  }
}
