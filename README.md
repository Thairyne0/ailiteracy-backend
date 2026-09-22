# Backend lead AI Literacy

NestJS 12 · Prisma 7 · PostgreSQL 17 · Nodemailer (turbo-smtp) · pdfkit

Riceve i lead della landing (`../front-end`), li salva, genera un codice sconto per ente di
formazione e invia le email (codice + listino PDF agli enti, conferma alle aziende).

## Avvio locale

```bash
cp .env.example .env          # compila API_KEY, SMTP_USER, SMTP_PASS
docker compose up -d postgres
npm install
npx prisma migrate dev
npm run start:dev             # http://localhost:4000
```

Tutto in Docker (Postgres + backend): `docker compose --profile full up -d --build`.

## API

Header `X-Api-Key: <API_KEY>` su tutte le rotte tranne `/health`.

| Metodo | Path | Descrizione |
|---|---|---|
| POST | `/leads` | crea lead; body come il form del front. Risposta `{ ok, discountCode? }` |
| GET | `/leads?type=ente\|azienda&page=1&pageSize=20` | lista paginata con codice e ultima email |
| POST | `/leads/:id/resend` | rispedisce l'email prevista per il tipo |
| GET | `/leads/subject?email=` | diritto di accesso (art. 15): tutti i dati di un'email |
| DELETE | `/leads/subject?email=` | diritto alla cancellazione (art. 17): elimina lead, codici, log |
| GET | `/health` | stato servizio e DB |

## Test

```bash
npm test          # unit
npm run test:e2e  # richiede Postgres (docker compose) — nessuna email parte
```

## Configurazione

Vedi `.env.example`. `SMTP_HOST=json` disattiva l'invio (utile in sviluppo).
`RETENTION_MONTHS` (default 24) cancella ogni notte alle 3 i lead più vecchi, come dichiarato nell'informativa; 0 disattiva.
`LEAD_NOTIFY_TO` invia una copia interna per ogni lead; `DISCOUNT_PERCENT` mostra la percentuale
in email e PDF. Le fasce del listino PDF sono in `src/config/listino.ts` (valori placeholder).

## Deploy

Istruzioni per Plesk: [`DEPLOY.md`](DEPLOY.md). Variabili di produzione: `.env.production.example`.
In alternativa l'immagine Docker (`Dockerfile`) è pronta per qualsiasi piattaforma a container.

## Integrazione front-end

Nel front-end impostare `BACKEND_URL=http://localhost:4000` e `BACKEND_API_KEY` uguale ad `API_KEY`.
`front-end/lib/lead-sink.ts` chiama `POST /leads` lato server.
