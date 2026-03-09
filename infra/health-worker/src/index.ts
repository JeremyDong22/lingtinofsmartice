import type { Env } from './types';
import { runHeartbeat } from './heartbeat';
import { runPatrol } from './patrol';
import { runFeedbackDigest } from './feedback-digest';

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const hour = new Date(event.scheduledTime).getUTCHours();

    if (hour === 1 || hour === 7) {
      // 01:00 UTC = 09:00 CST, 07:00 UTC = 15:00 CST
      ctx.waitUntil(runPatrol(env));
    } else {
      // Every 5 minutes heartbeat
      ctx.waitUntil(runHeartbeat(env));
    }
  },

  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'heartbeat') {
      ctx.waitUntil(runHeartbeat(env));
      return new Response(JSON.stringify({ ok: true, action: 'heartbeat' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'patrol') {
      ctx.waitUntil(runPatrol(env));
      return new Response(JSON.stringify({ ok: true, action: 'patrol' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'feedback-digest') {
      const secret = request.headers.get('X-Worker-Secret');
      if (env.WORKER_SECRET && secret !== env.WORKER_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
      const feedbackId = url.searchParams.get('feedback_id') || undefined;
      ctx.waitUntil(runFeedbackDigest(env, feedbackId));
      return new Response(JSON.stringify({ ok: true, action: 'feedback-digest' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      service: 'lingtin-health',
      usage: '?action=heartbeat|patrol|feedback-digest',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
