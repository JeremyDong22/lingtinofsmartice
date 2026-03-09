// Activity Logger Interceptor - Tracks all API requests for user activity analytics
// v1.0 - Global interceptor, async fire-and-forget writes

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SupabaseService } from '../supabase/supabase.service';

// Paths to skip logging (internal/health endpoints)
const SKIP_PATHS = [
  '/api/audio/stt-health',
  '/api/health',
  '/api/activity',
  '/favicon.ico',
];

// Map path prefix → resource_type
const RESOURCE_MAP: Array<[string, string]> = [
  ['/api/auth', 'auth'],
  ['/api/dashboard', 'dashboard'],
  ['/api/audio', 'audio'],
  ['/api/action-items', 'action-items'],
  ['/api/meeting', 'meeting'],
  ['/api/chat', 'chat'],
  ['/api/feedback', 'feedback'],
  ['/api/staff', 'staff'],
  ['/api/daily-summary', 'daily-summary'],
  ['/api/question-templates', 'question-templates'],
  ['/api/region', 'region'],
  ['/api/hotword', 'hotword'],
  ['/api/activity', 'activity'],
];

function getResourceType(path: string): string {
  for (const [prefix, type] of RESOURCE_MAP) {
    if (path.startsWith(prefix)) return type;
  }
  return 'other';
}

function getActionType(method: string, path: string): string {
  if (path.startsWith('/api/auth/login')) return 'login';
  if (path.startsWith('/api/auth/logout')) return 'logout';
  if (method === 'GET') return 'api_read';
  return 'api_write'; // POST, PATCH, PUT, DELETE
}

@Injectable()
export class ActivityLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLoggerInterceptor.name);

  constructor(private readonly supabase: SupabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    // Extract path without query string
    const path = url.split('?')[0];

    // Skip internal endpoints
    if (SKIP_PATHS.some((p) => path.startsWith(p))) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        // Fire-and-forget: log activity after successful response
        const user = request.user;
        if (!user?.id) return; // Skip unauthenticated requests

        this.logActivity(user, method, path, request).catch((err) => {
          this.logger.warn(`Activity log failed: ${err.message}`);
        });
      }),
    );
  }

  private async logActivity(
    user: any,
    method: string,
    path: string,
    request: any,
  ): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('lingtin_user_activity_log')
      .insert({
        user_id: user.id,
        username: user.username,
        employee_name: user.employeeName,
        role_code: user.roleCode,
        restaurant_id: user.restaurantId,
        action_type: getActionType(method, path),
        method,
        path,
        resource_type: getResourceType(path),
        ip_address:
          request.headers['x-forwarded-for'] ||
          request.headers['x-real-ip'] ||
          request.ip,
        user_agent: request.headers['user-agent'],
      });

    if (error) {
      throw new Error(error.message);
    }
  }
}
