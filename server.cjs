// Punto di avvio per Plesk (Phusion Passenger).
// Il progetto è ESM: questo file CommonJS carica l'app compilata in modo compatibile.
// Passenger intercetta app.listen(), quindi la porta indicata in .env viene ignorata dal proxy.
import('./dist/main.js').catch((err) => {
  console.error('Avvio fallito:', err);
  process.exit(1);
});
