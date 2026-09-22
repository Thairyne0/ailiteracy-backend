import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Ambiente impostato in test/setup-e2e.ts: DB di docker-compose, nessuna email (SMTP_HOST=json).
const KEY = process.env.API_KEY;

const ente = {
  type: 'ente',
  nomeEnte: 'Ente E2E',
  regione: 'Campania',
  partitaIva: '99999999901',
  referente: 'Mario Rossi',
  email: 'e2e@example.com',
  telefono: '+39 333 1234567',
  privacy: true,
};

describe('Leads API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.emailLog.deleteMany();
    await prisma.discountCode.deleteMany();
    await prisma.lead.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health', async () => {
    await request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok', database: 'ok' });
  });

  it('POST /leads senza API key → 401', async () => {
    await request(app.getHttpServer()).post('/leads').send(ente).expect(401);
  });

  it('POST /leads con body invalido → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/leads')
      .set('x-api-key', KEY!)
      .send({ ...ente, partitaIva: '12', privacy: false })
      .expect(400);
    expect(res.body.message).toEqual(expect.arrayContaining([expect.stringContaining('partita IVA')]));
  });

  it('POST /leads ente → 201 con codice, lead e email loggata', async () => {
    const res = await request(app.getHttpServer()).post('/leads').set('x-api-key', KEY!).send(ente).expect(201);
    expect(res.body).toEqual({ ok: true, discountCode: expect.stringMatching(/^AILIT-[A-Z2-9]{6}$/) });

    const leads = await prisma.lead.findMany({ include: { discountCode: true, emails: true } });
    expect(leads).toHaveLength(1);
    expect(leads[0]!.discountCode?.code).toBe(res.body.discountCode);
    expect(leads[0]!.emails[0]).toMatchObject({ template: 'ente-code', status: 'SENT', to: 'e2e@example.com' });
  });

  it('stesso ente (P.IVA) → stesso codice, nuovo lead', async () => {
    const a = await request(app.getHttpServer()).post('/leads').set('x-api-key', KEY!).send(ente).expect(201);
    const b = await request(app.getHttpServer())
      .post('/leads')
      .set('x-api-key', KEY!)
      .send({ ...ente, partitaIva: '999 999 999 01', referente: 'Altro Referente' })
      .expect(201);
    expect(b.body.discountCode).toBe(a.body.discountCode);
    expect(await prisma.lead.count()).toBe(2);
    expect(await prisma.discountCode.count()).toBe(1);
  });

  it('POST /leads azienda → 201 senza codice', async () => {
    const res = await request(app.getHttpServer())
      .post('/leads')
      .set('x-api-key', KEY!)
      .send({ ...ente, type: 'azienda', regione: undefined, settore: 'Altro' })
      .expect(201);
    expect(res.body).toEqual({ ok: true });
    expect(await prisma.discountCode.count()).toBe(0);
  });

  it('honeypot compilato → 200-like ok senza salvataggio', async () => {
    await request(app.getHttpServer()).post('/leads').set('x-api-key', KEY!).send({ ...ente, website: 'spam' }).expect(201);
    expect(await prisma.lead.count()).toBe(0);
  });

  it('GET /leads lista paginata con codice e ultima email', async () => {
    await request(app.getHttpServer()).post('/leads').set('x-api-key', KEY!).send(ente).expect(201);
    const res = await request(app.getHttpServer()).get('/leads?type=ente&pageSize=5').set('x-api-key', KEY!).expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      nomeEnte: 'Ente E2E',
      discountCode: { code: expect.stringMatching(/^AILIT-/) },
      lastEmail: { template: 'ente-code', status: 'SENT' },
    });
  });

  it('salva la versione dell\'informativa accettata', async () => {
    await request(app.getHttpServer())
      .post('/leads')
      .set('x-api-key', KEY!)
      .send({ ...ente, privacyVersion: '2026-09-21' })
      .expect(201);
    const lead = await prisma.lead.findFirstOrThrow();
    expect(lead.privacyVersion).toBe('2026-09-21');
    expect(lead.privacyAcceptedAt).toBeInstanceOf(Date);
  });

  it('GET /leads/subject esporta tutti i dati di una email', async () => {
    await request(app.getHttpServer()).post('/leads').set('x-api-key', KEY!).send(ente).expect(201);
    const res = await request(app.getHttpServer())
      .get('/leads/subject?email=E2E@example.com')
      .set('x-api-key', KEY!)
      .expect(200);
    expect(res.body.leads).toHaveLength(1);
    expect(res.body.leads[0].discountCode.code).toMatch(/^AILIT-/);
    expect(res.body.leads[0].emails).toHaveLength(1);
  });

  it('DELETE /leads/subject cancella lead, codice e log', async () => {
    await request(app.getHttpServer()).post('/leads').set('x-api-key', KEY!).send(ente).expect(201);
    await request(app.getHttpServer())
      .post('/leads')
      .set('x-api-key', KEY!)
      .send({ ...ente, email: 'altro@example.com', partitaIva: '99999999902' })
      .expect(201);
    const res = await request(app.getHttpServer())
      .delete('/leads/subject?email=e2e@example.com')
      .set('x-api-key', KEY!)
      .expect(200);
    expect(res.body).toEqual({ deletedLeads: 1, deletedCodes: 1 });
    expect(await prisma.lead.count()).toBe(1);
    expect(await prisma.discountCode.count()).toBe(1);
    expect(await prisma.emailLog.count()).toBe(1);
  });

  it('DELETE /leads/subject con email invalida → 400', async () => {
    await request(app.getHttpServer()).delete('/leads/subject?email=nope').set('x-api-key', KEY!).expect(400);
  });

  it('retention: cancella solo i lead più vecchi della soglia', async () => {
    await request(app.getHttpServer()).post('/leads').set('x-api-key', KEY!).send(ente).expect(201);
    const old = await prisma.lead.create({
      data: {
        type: 'AZIENDA', nomeEnte: 'Vecchia', settore: 'Altro', partitaIva: '99999999903',
        referente: 'A B', email: 'old@example.com', telefono: '3331234567',
        privacyAcceptedAt: new Date('2023-01-01'), createdAt: new Date('2023-01-01'),
      },
    });
    const { LeadsService } = await import('../src/leads/leads.service.js');
    const res = await app.get(LeadsService).purgeOlderThan(24);
    expect(res.deletedLeads).toBe(1);
    expect(await prisma.lead.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.lead.count()).toBe(1);
  });

  it('POST /leads/:id/resend rispedisce e logga', async () => {
    await request(app.getHttpServer()).post('/leads').set('x-api-key', KEY!).send(ente).expect(201);
    const lead = await prisma.lead.findFirstOrThrow();
    await request(app.getHttpServer()).post(`/leads/${lead.id}/resend`).set('x-api-key', KEY!).expect(200);
    expect(await prisma.emailLog.count({ where: { leadId: lead.id } })).toBe(2);
  });
});
