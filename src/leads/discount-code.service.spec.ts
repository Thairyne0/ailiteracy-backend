import { Prisma } from '../generated/prisma/client.js';
import { DiscountCodeService } from './discount-code.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function makePrisma(overrides: Partial<{ findUnique: unknown; create: unknown }> = {}) {
  return {
    discountCode: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      ...overrides,
    },
  } as unknown as PrismaService;
}

describe('DiscountCodeService', () => {
  it('genera codici nel formato AILIT-XXXXXX con alfabeto senza ambigui', () => {
    const svc = new DiscountCodeService(makePrisma());
    for (let i = 0; i < 1000; i++) {
      expect(svc.generate()).toMatch(/^AILIT-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it('riusa il codice esistente per la stessa P.IVA', async () => {
    const prisma = makePrisma({ findUnique: vi.fn().mockResolvedValue({ code: 'AILIT-AAAAAA' }) });
    const svc = new DiscountCodeService(prisma);
    await expect(svc.getOrCreateForEnte('12345678901', 'lead-1')).resolves.toEqual({
      code: 'AILIT-AAAAAA',
      reused: true,
    });
    expect((prisma as unknown as { discountCode: { create: unknown } }).discountCode.create).not.toHaveBeenCalled();
  });

  it('crea un nuovo codice quando non esiste', async () => {
    const svc = new DiscountCodeService(makePrisma());
    const res = await svc.getOrCreateForEnte('12345678901', 'lead-1');
    expect(res.reused).toBe(false);
    expect(res.code).toMatch(/^AILIT-/);
  });

  it('riprova su violazione di unicità del codice', async () => {
    const unique = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
    const create = vi.fn().mockRejectedValueOnce(unique).mockImplementation(({ data }) => Promise.resolve(data));
    const svc = new DiscountCodeService(makePrisma({ create }));
    const res = await svc.getOrCreateForEnte('12345678901', 'lead-1');
    expect(res.reused).toBe(false);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('rilancia errori diversi da P2002', async () => {
    const create = vi.fn().mockRejectedValue(new Error('db down'));
    const svc = new DiscountCodeService(makePrisma({ create }));
    await expect(svc.getOrCreateForEnte('12345678901', 'lead-1')).rejects.toThrow('db down');
  });
});
