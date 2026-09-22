import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { EmailStatus, LeadType } from '../generated/prisma/client.js';
import { LeadsService } from './leads.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { MailService } from '../mail/mail.service.js';
import type { ListinoPdfService } from '../pdf/listino-pdf.service.js';
import type { DiscountCodeService } from './discount-code.service.js';
import type { CreateLeadDto } from './dto/create-lead.dto.js';

const enteDto: CreateLeadDto = {
  type: 'ente',
  nomeEnte: 'Ente Test',
  regione: 'Campania',
  partitaIva: '12345678901',
  referente: 'Mario Rossi',
  email: 'mario@ente.it',
  telefono: '3331234567',
  privacy: true,
};

function setup(opts: { notifyTo?: string; mailFails?: boolean } = {}) {
  const prisma = {
    lead: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'lead-1', createdAt: new Date(), ...data })),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    emailLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const mail = {
    send: opts.mailFails ? vi.fn().mockRejectedValue(new Error('smtp down')) : vi.fn().mockResolvedValue({ messageId: 'm' }),
  };
  const pdf = { build: vi.fn().mockResolvedValue(Buffer.from('%PDF-fake')) };
  const codes = { getOrCreateForEnte: vi.fn().mockResolvedValue({ code: 'AILIT-ABC234', reused: false }) };
  const config = {
    get: vi.fn((key: string) =>
      ({ FRONTEND_URL: 'http://localhost:3000', LEAD_NOTIFY_TO: opts.notifyTo, DISCOUNT_PERCENT: 10 })[key],
    ),
  } as unknown as ConfigService<Env, true>;
  const service = new LeadsService(
    prisma as unknown as PrismaService,
    mail as unknown as MailService,
    pdf as unknown as ListinoPdfService,
    codes as unknown as DiscountCodeService,
    config,
  );
  return { service, prisma, mail, pdf, codes };
}

describe('LeadsService.create', () => {
  it('ente: salva, genera codice, invia email con PDF e logga SENT', async () => {
    const { service, prisma, mail, pdf, codes } = setup();
    const res = await service.create(enteDto);

    expect(res).toEqual({ ok: true, id: 'lead-1', discountCode: 'AILIT-ABC234' });
    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: LeadType.ENTE, regione: 'Campania', settore: null }) }),
    );
    expect(codes.getOrCreateForEnte).toHaveBeenCalledWith('12345678901', 'lead-1');
    expect(pdf.build).toHaveBeenCalledWith(expect.objectContaining({ code: 'AILIT-ABC234', discountPercent: 10 }));
    const sent = mail.send.mock.calls[0]![0];
    expect(sent.to).toBe('mario@ente.it');
    expect(sent.text).toContain('AILIT-ABC234');
    expect(sent.attachments?.[0]?.filename).toBe('listino-ai-literacy-AILIT-ABC234.pdf');
    expect(prisma.emailLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ template: 'ente-code', status: EmailStatus.SENT }) }),
    );
  });

  it('azienda: nessun codice, email di conferma', async () => {
    const { service, mail, codes } = setup();
    const res = await service.create({ ...enteDto, type: 'azienda', regione: undefined, settore: 'Altro' });

    expect(res.discountCode).toBeUndefined();
    expect(codes.getOrCreateForEnte).not.toHaveBeenCalled();
    expect(mail.send.mock.calls[0]![0].subject).toContain('preventivo');
    expect(mail.send.mock.calls[0]![0].attachments).toBeUndefined();
  });

  it('email fallita: risposta ok con codice, log FAILED', async () => {
    const { service, prisma } = setup({ mailFails: true });
    const res = await service.create(enteDto);

    expect(res.discountCode).toBe('AILIT-ABC234');
    expect(prisma.emailLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: EmailStatus.FAILED, error: 'smtp down' }) }),
    );
  });

  it('con LEAD_NOTIFY_TO invia anche la copia interna', async () => {
    const { service, mail } = setup({ notifyTo: 'team@example.com' });
    await service.create(enteDto);
    expect(mail.send).toHaveBeenCalledTimes(2);
    expect(mail.send.mock.calls[1]![0].to).toBe('team@example.com');
  });
});

describe('LeadsService.resend', () => {
  it('404 se il lead non esiste', async () => {
    const { service, prisma } = setup();
    prisma.lead.findUnique.mockResolvedValue(null);
    await expect(service.resend('missing')).rejects.toThrow('Lead non trovato');
  });

  it('rispedisce con lo stesso codice', async () => {
    const { service, prisma, mail } = setup();
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1', type: LeadType.ENTE, nomeEnte: 'Ente', regione: 'Lazio', settore: null,
      partitaIva: '12345678901', referente: 'A B', email: 'a@b.it', telefono: '3331234567',
    });
    const res = await service.resend('lead-1');
    expect(res).toEqual({ ok: true, discountCode: 'AILIT-ABC234' });
    expect(mail.send).toHaveBeenCalledTimes(1);
  });
});
