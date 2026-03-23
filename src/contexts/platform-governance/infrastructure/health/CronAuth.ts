import { env } from '@/src/config/env';

type CronAuthSource = {
  HEALTH_PROBE_CRON_TOKEN?: string;
  CRON_SECRET?: string;
};

export class CronAuth {
  private readonly token?: string;

  constructor(source: CronAuthSource = env) {
    this.token = source.HEALTH_PROBE_CRON_TOKEN?.trim() || source.CRON_SECRET?.trim() || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.token);
  }

  authorize(request: Request): boolean {
    if (!this.token) {
      return false;
    }

    const header = request.headers.get('authorization')?.trim();

    if (!header?.startsWith('Bearer ')) {
      return false;
    }

    return header.slice('Bearer '.length).trim() === this.token;
  }
}
