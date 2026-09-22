# Deploy su Plesk

Istruzioni per chi carica il backend sul server. Tempo stimato: 20–30 minuti.

Il backend è un'applicazione **Node.js 22 + PostgreSQL**. Non è un sito PHP: serve
l'estensione **Node.js** di Plesk (Phusion Passenger) e un database **PostgreSQL**.

---

## 0. Prerequisiti da verificare PRIMA di iniziare

| Requisito | Come verificarlo | Se manca |
|---|---|---|
| Node.js ≥ 22 | Plesk > Strumenti e impostazioni > Aggiornamenti > Componenti | Installare il componente Node.js |
| Estensione Node.js | Plesk > Estensioni > "Node.js" | Installarla (gratuita) |
| **PostgreSQL** | Plesk > Strumenti e impostazioni > Impostazioni database | **Bloccante**: il progetto non funziona con MySQL/MariaDB. Installare PostgreSQL sul server oppure usare un database PostgreSQL esterno e metterne l'URL in `DATABASE_URL` |
| Certificato SSL sul dominio | Plesk > Dominio > Certificati SSL/TLS | Attivare Let's Encrypt: le richieste contengono dati personali, HTTPS è obbligatorio |
| Porta SMTP 465 in uscita | `nc -zv pro.eu.turbo-smtp.com 465` da SSH | Chiedere all'hosting di aprirla, altrimenti le email non partono |

## 1. Scelta del dominio

Il backend espone solo API (nessuna pagina). Due possibilità:

- **Consigliata** — backend su `api.ailiteracy.generazioneai.it`, landing su `ailiteracy.generazioneai.it`.
- Alternativa — backend su `ailiteracy.generazioneai.it` e landing altrove (es. Vercel).

In entrambi i casi la landing chiama il backend **da server a server**, non dal browser:
non servono impostazioni CORS.

## 2. Creare il database

Plesk > Database > **Aggiungi database**
- Tipo: **PostgreSQL**
- Nome: `ailiteracy`
- Utente dedicato con password generata da Plesk (non riusare password esistenti)

Annota nome, utente e password: servono per `DATABASE_URL`.

## 3. Caricare il codice

Plesk > Dominio > **Git**: collega il repository e imposta il branch `main`.
In alternativa carica i file via File Manager nella cartella del dominio.

**Non caricare** `node_modules`, `dist`, `.env`: vengono creati sul server.

## 4. Configurare l'applicazione Node.js

Plesk > Dominio > **Node.js**:

| Campo | Valore |
|---|---|
| Node.js Version | 22 (o superiore) |
| Application Mode | `production` |
| Application Root | cartella del repository (dove sta `package.json`) |
| Document Root | la stessa cartella (non c'è contenuto statico) |
| Application Startup File | `server.cjs` |

## 5. Variabili d'ambiente

Nella stessa pagina Node.js, sezione **Custom environment variables**, aggiungi le voci
elencate in `.env.production.example`. Le obbligatorie:

```
DATABASE_URL   postgresql://UTENTE:PASSWORD@localhost:5432/ailiteracy?schema=public
NODE_ENV       production
TRUST_PROXY    true
API_KEY        (generare: openssl rand -hex 32)
SMTP_HOST      pro.eu.turbo-smtp.com
SMTP_PORT      465
SMTP_SECURE    true
SMTP_USER      (fornito da chi gestisce turboSMTP)
SMTP_PASS      (fornito da chi gestisce turboSMTP)
MAIL_FROM      Generazione Ai <hello@generazioneai.it>
MAIL_REPLY_TO  hello@generazioneai.it
FRONTEND_URL   https://ailiteracy.generazioneai.it
RETENTION_MONTHS 24
```

`API_KEY` va comunicata a chi configura la landing: deve combaciare, altrimenti i form
rispondono "Invio non riuscito".

> In alternativa si può creare un file `.env` nella Application Root con lo stesso contenuto.
> Il file **non** deve finire nel repository.

## 6. Installare e compilare

Pulsante **NPM install** nella pagina Node.js, poi **Run script** → `deploy`.

Da SSH è equivalente a:

```bash
cd /var/www/vhosts/<dominio>/<cartella>
npm install            # servono anche le devDependencies per compilare
npm run deploy         # prisma generate + migrate deploy + build
```

`npm run deploy` crea le tabelle al primo avvio e applica gli aggiornamenti a ogni rilascio.

## 7. Avviare e verificare

Pulsante **Restart App**. Poi:

```bash
curl https://api.ailiteracy.generazioneai.it/health
# atteso: {"status":"ok","database":"ok"}
```

Nei log dell'applicazione (Plesk > Log, oppure `logs/` nella cartella del dominio) devono comparire:

```
[MailService] Connessione SMTP verificata
[Bootstrap] Backend in ascolto su :4000
```

Prova completa (sostituisci `LA_TUA_API_KEY` e l'indirizzo email):

```bash
curl -X POST https://api.ailiteracy.generazioneai.it/leads \
  -H "content-type: application/json" \
  -H "x-api-key: LA_TUA_API_KEY" \
  -d '{"type":"ente","nomeEnte":"Prova","regione":"Campania","partitaIva":"12345678901","referente":"Mario Rossi","email":"tua@email.it","telefono":"3331234567","privacy":true}'
# atteso: {"ok":true,"discountCode":"AILIT-XXXXXX"} e l'email con il PDF in arrivo
```

## 8. Aggiornamenti successivi

```bash
git pull
npm install
npm run deploy
```
poi **Restart App** da Plesk.

---

## Note importanti

**Backup del database.** Le tabelle contengono dati personali (nome, email, telefono,
partita IVA dei referenti). Configurare in Plesk un backup periodico del database
`ailiteracy`, conservato in modo cifrato. È un requisito dell'art. 32 GDPR, non un optional.

**Cancellazione automatica.** Ogni notte alle 3 (ora del server) l'applicazione elimina i
lead più vecchi di `RETENTION_MONTHS` mesi, come dichiarato nell'informativa privacy.
Deve quindi restare sempre avviata; se Plesk la mette in sleep per inattività, disattivare
quell'opzione.

**Endpoint riservati.** `GET /leads`, `GET /leads/subject`, `DELETE /leads/subject` e
`POST /leads/:id/resend` restituiscono o cancellano dati personali. Sono protetti dalla sola
`API_KEY`: trattarla come una password, non inserirla in pagine web o app che girano nel browser.

**Fuso orario.** Verificare che il server sia su `Europe/Rome`, altrimenti l'orario della
pulizia notturna e le date registrate risulteranno sfasati.
