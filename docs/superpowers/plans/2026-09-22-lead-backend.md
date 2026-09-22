# Lead Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend NestJS che riceve i lead della landing, li persiste su Postgres, genera un codice sconto per ente e invia le email (codice + listino PDF agli enti, conferma alle aziende).

**Architecture:** Nest 12 modulare (`prisma`, `mail`, `pdf`, `leads`, `health`), Prisma 7 con adapter pg, guard API key, env validate con zod. Email sincrona con log su `EmailLog`; nessuna coda.

**Tech Stack:** NestJS 12, Prisma 7.10, PostgreSQL 17, Nodemailer, pdfkit, class-validator, zod, helmet, @nestjs/throttler, Jest, supertest, Docker.

Spec: `docs/superpowers/specs/2026-09-22-lead-backend-design.md`

---

## File map

| File | Responsabilità |
|---|---|
| `prisma/schema.prisma`, `prisma.config.ts`, `prisma/migrations/*` | modello dati, config Prisma 7 |
| `src/prisma/prisma.module.ts`, `prisma.service.ts` | client Prisma con adapter pg, lifecycle |
| `src/config/env.ts` | schema zod env + `validateEnv` |
| `src/config/listino.ts` | fasce prezzo per il PDF |
| `src/config/company.ts` | dati societari per footer email/PDF |
| `src/common/api-key.guard.ts` | guard `X-Api-Key` |
| `src/health/health.controller.ts` | `GET /health` |
| `src/leads/dto/create-lead.dto.ts`, `list-leads.dto.ts` | validazione input |
| `src/leads/discount-code.service.ts` | generazione codice |
| `src/leads/leads.service.ts`, `leads.controller.ts`, `leads.module.ts` | logica lead |
| `src/mail/mail.service.ts`, `mail.module.ts`, `templates/*.ts` | invio email |
| `src/pdf/listino-pdf.service.ts`, `pdf.module.ts` | PDF listino |
| `src/main.ts`, `src/app.module.ts` | bootstrap: helmet, throttler, validation pipe |
| `test/leads.e2e-spec.ts` | e2e su Postgres docker |
| `Dockerfile`, `docker-compose.yml`, `.env.example` | runtime |

---

### Task 1: Scaffold
- [ ] `npx @nestjs/cli@latest new back --package-manager npm --skip-git --strict` (nella cartella `landing-page/`, nome cartella `back`, già esistente e vuota → usare `.`)
- [ ] deps: `@prisma/client @prisma/adapter-pg @nestjs/config @nestjs/throttler class-validator class-transformer nodemailer pdfkit helmet zod pg`; dev: `prisma@7 @types/nodemailer @types/pdfkit @types/pg`
- [ ] `docker-compose.yml` postgres:17-alpine, user/pass/db `ailiteracy`, porta 5432, volume
- [ ] `.env` (gitignorato) e `.env.example`: `DATABASE_URL`, `PORT=4000`, `API_KEY`, `SMTP_*`, `MAIL_FROM`, `FRONTEND_URL`, `LEAD_NOTIFY_TO=`, `DISCOUNT_PERCENT=`, `TRUST_PROXY=false`
- [ ] `docker compose up -d postgres`; commit

### Task 2: Prisma
- [ ] `prisma.config.ts` con `defineConfig({ schema, migrations, datasource: { url: env("DATABASE_URL") } })`
- [ ] `schema.prisma` come da spec, generator `prisma-client` output `../src/generated/prisma`, `moduleFormat = "cjs"`
- [ ] `npx prisma migrate dev --name init`; `PrismaService extends PrismaClient` con `PrismaPg` adapter, `onModuleInit` connect, `onModuleDestroy` disconnect; `PrismaModule` `@Global()`
- [ ] escludere `src/generated` da eslint/jest coverage; commit

### Task 3: Config e bootstrap
- [ ] `src/config/env.ts`: zod schema (`DATABASE_URL` url, `PORT` int default 4000, `API_KEY` min 16, `SMTP_HOST`, `SMTP_PORT` int, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` bool, `MAIL_FROM`, `MAIL_REPLY_TO?`, `FRONTEND_URL` url, `LEAD_NOTIFY_TO?` email o vuoto, `DISCOUNT_PERCENT?` int 1–100, `TRUST_PROXY` bool); `validateEnv(config)` lancia errore leggibile
- [ ] `AppModule`: `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })`, `ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }])`, `APP_GUARD` ThrottlerGuard
- [ ] `main.ts`: `helmet()`, `trust proxy`, `ValidationPipe({ whitelist: true, transform: true })`, listen `PORT`
- [ ] `src/common/api-key.guard.ts`: legge `x-api-key`, confronta con `timingSafeEqual` (lunghezze diverse → false), 401
- [ ] `HealthController`: `GET /health` → `SELECT 1` via prisma; commit

### Task 4: DTO + test
- [ ] `create-lead.dto.ts`: `type` in `['ente','azienda']`, campi con decoratori; `@ValidateIf(o => o.type === 'ente')` su `regione` `@IsIn(REGIONI)`, idem `settore`; `partitaIva` `@Transform(strip spaces)` + `@Matches(/^\d{11}$/)`; `privacy` `@Equals(true)`; `website` `@IsOptional() @IsString()`
- [ ] `list-leads.dto.ts`: `type?`, `page` default 1, `pageSize` default 20 max 100
- [ ] `create-lead.dto.spec.ts`: valido ente, valido azienda, P.IVA con spazi ok, P.IVA corta ko, regione fuori lista ko, privacy false ko, settore mancante per azienda ko; commit

### Task 5: Codice sconto
- [ ] `discount-code.service.ts`: `generate(): string` con `randomInt`, alfabeto senza ambigui, formato `AILIT-XXXXXX`; `getOrCreateForEnte(partitaIva, leadId)` con retry su `P2002`
- [ ] spec: formato regex, 1000 generazioni tutte nell'alfabeto, retry su unique violation (prisma mock); commit

### Task 6: Mail + PDF
- [ ] `mail.service.ts`: transport da env (`SMTP_HOST === 'json'` → jsonTransport), `send({ to, subject, text, html, attachments? })`, `verify()` opzionale al boot in non-test
- [ ] `templates/layout.ts` (wrapper HTML + footer legale), `templates/ente-code.ts`, `templates/azienda-conferma.ts`, `templates/notify-internal.ts`
- [ ] `pdf/listino-pdf.service.ts`: `build({ ente, code, date }): Promise<Buffer>` con pdfkit; test: buffer inizia con `%PDF`; commit

### Task 7: LeadsService + controller
- [ ] `create(dto, meta)`: normalizza P.IVA, `prisma.lead.create`, se ENTE → `getOrCreateForEnte`, genera PDF, invia email `ente-code`; se AZIENDA → email `azienda-conferma`; `LEAD_NOTIFY_TO` → email interna; ogni invio in try/catch → `EmailLog` SENT/FAILED; ritorna `{ ok, discountCode? }`
- [ ] `findAll(query)`: paginazione, include `discountCode` e ultima email
- [ ] `resend(id)`: ricostruisce e rispedisce
- [ ] controller con `@UseGuards(ApiKeyGuard)`, `@Throttle` su POST
- [ ] spec con Prisma e Mail mockati: ente crea codice + email; stessa P.IVA riusa; email fallita → FAILED, risposta ok; azienda nessun codice; commit

### Task 8: E2E
- [ ] `test/leads.e2e-spec.ts`: app reale, env test (`SMTP_HOST=json`, DB docker), pulizia tabelle in `beforeEach`; casi: 401 senza key, 400 body invalido, 201 ente con codice, stesso ente stesso codice, 201 azienda senza codice, GET lista; commit

### Task 9: Docker
- [ ] `Dockerfile` multi-stage node:22-alpine (deps → build con `prisma generate` + `nest build` → runner con `prisma migrate deploy && node dist/main`), `.dockerignore`; servizio `backend` in compose (`depends_on` postgres healthcheck); `docker compose build` ok; commit

### Task 10: Front-end
- [ ] `front-end/lib/lead-sink.ts` → `POST ${BACKEND_URL}/leads` con `X-Api-Key`, ritorna `{ discountCode? }`; route usa il valore; `.env.example` aggiornato; `npm test` + build; commit (repo front-end)
