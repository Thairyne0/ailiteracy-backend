import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import type { LeadsService } from '../leads/leads.service.js';
import { RetentionService } from './retention.service.js';

function make(months: number, purge = vi.fn().mockResolvedValue({ deletedLeads: 2, deletedCodes: 1 })) {
  const leads = { purgeOlderThan: purge } as unknown as LeadsService;
  const config = { get: vi.fn().mockReturnValue(months) } as unknown as ConfigService<Env, true>;
  return { svc: new RetentionService(leads, config), purge };
}

describe('RetentionService', () => {
  it('cancella con i mesi configurati', async () => {
    const { svc, purge } = make(24);
    await svc.run();
    expect(purge).toHaveBeenCalledWith(24);
  });

  it('non fa nulla con RETENTION_MONTHS=0', async () => {
    const { svc, purge } = make(0);
    await svc.run();
    expect(purge).not.toHaveBeenCalled();
  });

  it('un errore non propaga', async () => {
    const { svc } = make(24, vi.fn().mockRejectedValue(new Error('db')));
    await expect(svc.run()).resolves.toBeUndefined();
  });
});
