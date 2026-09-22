import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../config/env.js';
import { LeadsService } from '../leads/leads.service.js';

/**
 * Applica la conservazione dichiarata nell'informativa (§5): i lead più vecchi
 * di RETENTION_MONTHS vengono cancellati ogni notte, con codici e log email.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  private readonly months: number;

  constructor(
    private readonly leads: LeadsService,
    config: ConfigService<Env, true>,
  ) {
    this.months = config.get('RETENTION_MONTHS', { infer: true });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    if (this.months === 0) return;
    try {
      const res = await this.leads.purgeOlderThan(this.months);
      if (res.deletedLeads > 0) {
        this.logger.log(`Retention ${this.months} mesi: cancellati ${res.deletedLeads} lead, ${res.deletedCodes} codici`);
      }
    } catch (err) {
      this.logger.error(`Retention fallita: ${(err as Error).message}`);
    }
  }
}
