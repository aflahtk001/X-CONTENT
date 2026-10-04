import cron, { ScheduledTask } from 'node-cron';
import { executeRun, loadSettings } from './pipeline/run';

let activeCronJob: ScheduledTask | null = null;

/**
 * Initializes or updates the internal node-cron scheduler.
 */
export async function initializeScheduler(): Promise<void> {
  if (process.env.SCHEDULER_MODE === 'external') {
    console.log('[Scheduler] Running in EXTERNAL mode. Cron is managed via /api/cron/run');
    return;
  }

  try {
    const settings = await loadSettings();
    const cronExpr = settings.schedule_cron || '0 */3 * * *';
    const timezone = settings.timezone || 'Asia/Kolkata';

    if (activeCronJob) {
      activeCronJob.stop();
      activeCronJob = null;
    }

    if (!cron.validate(cronExpr)) {
      console.error(`[Scheduler] Invalid cron expression: "${cronExpr}". Falling back to default "0 */3 * * *"`);
    }

    const validExpr = cron.validate(cronExpr) ? cronExpr : '0 */3 * * *';

    console.log(`[Scheduler] Scheduling cron job with expression: "${validExpr}" (Timezone: ${timezone})`);

    activeCronJob = cron.schedule(
      validExpr,
      async () => {
        console.log('[Scheduler] Triggering scheduled run...');
        try {
          await executeRun('schedule');
        } catch (err: any) {
          console.error('[Scheduler] Scheduled run failed/skipped:', err.message);
        }
      },
      {
        timezone: timezone,
      }
    );
  } catch (err: any) {
    console.error('[Scheduler] Failed to initialize scheduler:', err.message);
  }
}

/**
 * Helper to convert multiple time-of-day strings (e.g., ["09:00", "13:00", "18:00"]) to a cron expression.
 */
export function timesToCron(times: string[]): string {
  if (!times || times.length === 0) return '0 */3 * * *';

  const minutes = new Set<string>();
  const hours = new Set<string>();

  for (const t of times) {
    const [h, m] = t.split(':');
    if (h !== undefined && m !== undefined) {
      hours.add(parseInt(h, 10).toString());
      minutes.add(parseInt(m, 10).toString());
    }
  }

  const mStr = Array.from(minutes).join(',') || '0';
  const hStr = Array.from(hours).join(',') || '*';

  return `${mStr} ${hStr} * * *`;
}
