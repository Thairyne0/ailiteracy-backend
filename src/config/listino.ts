// Fasce del listino riservato enti. VALORI PLACEHOLDER: sostituire con il listino reale.
export type Tier = { min: number; max: number; price: number };

export const LISTINO_TIERS: readonly Tier[] = [
  { min: 1, max: 50, price: 100 },
  { min: 51, max: 100, price: 80 },
  { min: 101, max: 200, price: 70 },
  { min: 201, max: 1000, price: 60 },
  { min: 1001, max: 2000, price: 50 },
];

export const LISTINO_NOTES = [
  'Prezzi per corso, IVA esclusa.',
  'Gli scaglioni si applicano in modo progressivo sul numero di corsi acquistati.',
  'Listino valido salvo modifiche; il preventivo definitivo viene emesso su richiesta.',
] as const;

export const REGIONI = [
  'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna',
  'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche',
  'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana',
  'Trentino-Alto Adige', 'Umbria', "Valle d'Aosta", 'Veneto',
] as const;

export const SETTORI = [
  'Manifatturiero', 'Servizi alle imprese', 'Commercio e retail',
  'Finanza e assicurazioni', 'Sanità e farmaceutico', 'Pubblica amministrazione',
  'ICT e telecomunicazioni', 'Energia e utilities', 'Logistica e trasporti',
  'Edilizia e immobiliare', 'Turismo e ristorazione', 'Agroalimentare', 'Altro',
] as const;
