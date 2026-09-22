# Backend lead AI Literacy — design

Data: 2026-09-22 · Stato: approvato (chat)

## Obiettivo

Servizio che riceve i lead dei due form della landing (`front-end/`), li salva su Postgres e invia
email al richiedente: agli enti di formazione il codice sconto personale + listino riservato in PDF,
alle aziende una conferma di ricezione. Il codice sconto è unico per ente (P.IVA) e persistito.

## Stack

NestJS 12 (Express), Prisma 7 + `@prisma/adapter-pg`, PostgreSQL 17 (Docker), Nodemailer (SMTP
turbo-smtp), pdfkit, class-validator/class-transformer, zod (validazione env), Jest + supertest.
Node 22 in Docker, Node 25 in locale.

## Flusso

```
Next route /api/lead ──POST /leads (X-Api-Key)──▶ Nest :4000 ──▶ Postgres
   (server-to-server)                                 └──▶ SMTP → email al richiedente
```

Il front resta l'unico punto esposto al browser; il backend accetta solo richieste con `X-Api-Key`.

## Modello dati

```prisma
enum LeadType { ENTE AZIENDA }
enum EmailStatus { SENT FAILED }

model Lead {
  id                String   @id @default(uuid())
  type              LeadType
  nomeEnte          String
  regione           String?
  settore           String?
  partitaIva        String            // 11 cifre normalizzate
  referente         String
  email             String
  telefono          String
  privacyAcceptedAt DateTime
  createdAt         DateTime @default(now())
  discountCode      DiscountCode?     // solo per il primo lead dell'ente
  emails            EmailLog[]
  @@index([partitaIva])
  @@index([createdAt])
}

model DiscountCode {
  id         String    @id @default(uuid())
  code       String    @unique         // AILIT-XXXXXX
  partitaIva String    @unique         // un codice per ente
  lead       Lead      @relation(fields: [leadId], references: [id])
  leadId     String    @unique
  issuedAt   DateTime  @default(now())
  redeemedAt DateTime?
}

model EmailLog {
  id        String      @id @default(uuid())
  lead      Lead        @relation(fields: [leadId], references: [id])
  leadId    String
  to        String
  template  String      // ente-code | azienda-conferma
  status    EmailStatus
  error     String?
  createdAt DateTime    @default(now())
}
```

Regola: stesso ente (stessa P.IVA) che ricompila → nuovo `Lead` (audit), stesso `DiscountCode`,
email rispedita.

## API

| Metodo | Path | Auth | Note |
|---|---|---|---|
| POST | `/leads` | API key | body come il front (`type`, campi). Risposta `{ ok: true, discountCode? }`. 400 su validazione. |
| GET | `/leads?type=&page=&pageSize=` | API key | lista paginata, più recenti prima, con codice e stato ultima email |
| POST | `/leads/:id/resend` | API key | rispedisce l'email prevista per il tipo |
| GET | `/health` | — | `{ status: "ok" }` + ping DB |

Email fallita: lead salvato, codice restituito comunque, `EmailLog` FAILED con errore, HTTP 201.

## Validazione (DTO)

Stesse regole del front: `nomeEnte` ≥2, `referente` ≥3, `email` valida, `telefono` ≥6 solo
`[+\d\s]`, `partitaIva` 11 cifre dopo rimozione spazi, `privacy === true`, `regione` ∈ 20 regioni
(solo ENTE), `settore` ∈ lista (solo AZIENDA). Campo `website` (honeypot) accettato e ignorato.
`ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true })`.

## Codice sconto

`AILIT-` + 6 caratteri dall'alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (niente 0/O/1/I),
generati con `crypto.randomInt`. Unicità garantita dal DB; su collisione si rigenera (max 5 tentativi).

## Email

- Trasporto: SMTP `pro.eu.turbo-smtp.com:465` TLS, credenziali da env. In test `SMTP_HOST=json` →
  `jsonTransport` (nessun invio).
- `MAIL_FROM` (default `Generazione Ai <hello@generazioneai.it>`), `MAIL_REPLY_TO` opzionale.
- Template testo + HTML, italiano, footer legale (ragione sociale, sede, P.IVA, link privacy su
  `FRONTEND_URL/privacy`).
- **ente-code**: codice in evidenza, listino PDF allegato (`listino-ai-literacy-<code>.pdf`),
  eventuale `DISCOUNT_PERCENT` se impostato.
- **azienda-conferma**: riepilogo richiesta, ricontatto entro 24 ore lavorative.
- `LEAD_NOTIFY_TO` opzionale: se impostato, copia interna sintetica per ogni lead.

## PDF listino

Generato al volo con pdfkit (font Helvetica, WinAnsi → accenti ed € ok): intestazione Generazione Ai,
"Listino riservato enti di formazione", intestatario, data, codice sconto, tabella fasce da
`src/config/listino.ts` (stesse fasce placeholder del calcolatore: 1–50 100 €, 51–100 80 €,
101–200 70 €, 201–1000 60 €, 1001–2000 50 €), note "prezzi IVA esclusa, listino valido salvo
modifiche", footer legale. I valori sono placeholder da sostituire.

## Sicurezza e best practice

- `helmet`, `@nestjs/throttler` (20 req/min per IP su `/leads`), `trust proxy` da env.
- API key confrontata con `timingSafeEqual`.
- Env validate con zod all'avvio; il processo non parte se manca qualcosa.
- Log senza dati personali (solo id, tipo, esito).
- `.env` gitignorato; `.env.example` con placeholder. Le credenziali SMTP condivise in chat vanno
  ruotate appena possibile.
- Dockerfile multi-stage (Node 22 alpine), `docker-compose.yml` con Postgres + backend,
  `prisma migrate deploy` all'avvio del container.

## Integrazione front-end

`front-end/lib/lead-sink.ts` chiama `POST ${BACKEND_URL}/leads` con `X-Api-Key: ${BACKEND_API_KEY}`
e ritorna `{ discountCode? }`; la route Next usa quel valore. Senza `BACKEND_URL` (dev) resta il
comportamento attuale (log + codice da env).

## Test

- Unit: generatore codice (formato, alfabeto), `LeadsService` (crea codice, riusa per stessa P.IVA,
  email fallita non blocca), DTO (casi validi/invalidi).
- E2E: `POST /leads` senza key → 401; ente valido → 201 con codice e riga in DB; stessa P.IVA →
  stesso codice; azienda → nessun codice. Richiede Postgres (docker compose) e `SMTP_HOST=json`.

## Fuori scope

Interfaccia admin, coda email (BullMQ), riscatto del codice (campo `redeemedAt` già previsto),
manifest Kubernetes, notifica interna attiva di default.
