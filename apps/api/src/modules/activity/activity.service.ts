// Activity Service - Query user activity logs
// v1.0 - Overview + user timeline queries

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get overview of all users' activity within the given number of days.
   * Returns per-user: last active time, total actions, action breakdown by resource_type.
   */
  async getOverview(days: number = 7) {
    const client = this.supabase.getClient();
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get all activity in the period, grouped by user
    const { data, error } = await client
      .from('lingtin_user_activity_log')
      .select('user_id, username, employee_name, role_code, restaurant_id, action_type, resource_type, created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch activity overview: ${error.message}`);
      throw error;
    }

    // Aggregate by user
    const userMap = new Map<
      string,
      {
        user_id: string;
        username: string;
        employee_name: string;
        role_code: string;
        restaurant_id: string;
        last_active: string;
        total_actions: number;
        breakdown: Record<string, number>;
      }
    >();

    for (const row of data || []) {
      const existing = userMap.get(row.user_id);
      if (existing) {
        existing.total_actions++;
        existing.breakdown[row.resource_type] =
          (existing.breakdown[row.resource_type] || 0) + 1;
      } else {
        userMap.set(row.user_id, {
          user_id: row.user_id,
          username: row.username,
          employee_name: row.employee_name,
          role_code: row.role_code,
          restaurant_id: row.restaurant_id,
          last_active: row.created_at,
          total_actions: 1,
          breakdown: { [row.resource_type]: 1 },
        });
      }
    }

    // Also get users who had NO activity in this period (distinct users from all-time)
    const { data: allUsers, error: allError } = await client.rpc('get_distinct_activity_users');

    // Fallback: if RPC doesn't exist, query with limit
    if (allError) {
      this.logger.warn(`get_distinct_activity_users RPC failed, using fallback: ${allError.message}`);
      const { data: fallbackUsers } = await client
        .from('lingtin_user_activity_log')
        .select('user_id, username, employee_name, role_code, restaurant_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (fallbackUsers) {
        for (const row of fallbackUsers) {
          if (!userMap.has(row.user_id)) {
            userMap.set(row.user_id, {
              user_id: row.user_id,
              username: row.username,
              employee_name: row.employee_name,
              role_code: row.role_code,
              restaurant_id: row.restaurant_id,
              last_active: row.created_at,
              total_actions: 0,
              breakdown: {},
            });
          }
        }
      }
    } else if (allUsers) {
      for (const row of allUsers) {
        if (!userMap.has(row.user_id)) {
          userMap.set(row.user_id, {
            user_id: row.user_id,
            username: row.username,
            employee_name: row.employee_name,
            role_code: row.role_code,
            restaurant_id: row.restaurant_id,
            last_active: row.last_active,
            total_actions: 0,
            breakdown: {},
          });
        }
      }
    }

    const users = Array.from(userMap.values()).sort(
      (a, b) => b.total_actions - a.total_actions,
    );

    return {
      days,
      total_users: users.length,
      active_users: users.filter((u) => u.total_actions > 0).length,
      inactive_users: users.filter((u) => u.total_actions === 0).length,
      users,
    };
  }

  /**
   * Get detailed timeline for a specific user.
   */
  async getUserTimeline(
    userId: string,
    days: number = 7,
    page: number = 1,
    pageSize: number = 50,
  ) {
    if (!UUID_REGEX.test(userId)) {
      return { items: [], total: 0 };
    }

    const client = this.supabase.getClient();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await client
      .from('lingtin_user_activity_log')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      this.logger.error(`Failed to fetch user timeline: ${error.message}`);
      throw error;
    }

    return {
      items: data || [],
      total: count || 0,
      page,
      pageSize,
    };
  }
}
