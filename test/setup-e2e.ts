// Eseguito prima dell'import dei test: l'ambiente deve essere pronto
// quando AppModule (e quindi ConfigModule.forRoot) viene valutato.
import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.SMTP_HOST = 'json';
process.env.API_KEY = 'e2e-test-api-key-0123456789';
process.env.LEAD_NOTIFY_TO = '';
