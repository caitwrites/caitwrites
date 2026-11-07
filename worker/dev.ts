import worker from './index';
import type { Env } from './types';

// Wrangler 4.158.0 does not expose `.dev.vars` bindings to the configured
// entrypoint on this Windows setup. Forwarding through an explicit local
// entrypoint preserves the production handler while making local secrets
// available to both fetch and scheduled events.
export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return worker.fetch(request, {
      ...env,
      GOOGLE_SERVICE_ACCOUNT_EMAIL: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_PRIVATE_KEY: env.GOOGLE_PRIVATE_KEY,
      SYNC_SECRET: env.SYNC_SECRET,
    });
  },
  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    worker.scheduled(controller, {
      ...env,
      GOOGLE_SERVICE_ACCOUNT_EMAIL: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_PRIVATE_KEY: env.GOOGLE_PRIVATE_KEY,
      SYNC_SECRET: env.SYNC_SECRET,
    }, ctx);
  },
} satisfies ExportedHandler<Env>;
