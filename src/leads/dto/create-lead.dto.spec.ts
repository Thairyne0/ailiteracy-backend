import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLeadDto } from './create-lead.dto.js';

const ente = {
  type: 'ente',
  nomeEnte: 'Ente Formazione Test',
  regione: 'Campania',
  partitaIva: '12345678901',
  referente: 'Mario Rossi',
  email: 'mario@ente.it',
  telefono: '+39 333 1234567',
  privacy: true,
};

const azienda = { ...ente, type: 'azienda', regione: undefined, settore: 'Manifatturiero' };

async function errorsFor(body: object) {
  const dto = plainToInstance(CreateLeadDto, body);
  const errors = await validate(dto, { whitelist: true });
  return errors.map((e) => e.property);
}

describe('CreateLeadDto', () => {
  it('accetta un ente valido', async () => expect(await errorsFor(ente)).toEqual([]));
  it('accetta un\'azienda valida', async () => expect(await errorsFor(azienda)).toEqual([]));

  it('normalizza la P.IVA con spazi', async () => {
    const dto = plainToInstance(CreateLeadDto, { ...ente, partitaIva: '123 456 789 01' });
    expect(await validate(dto)).toEqual([]);
    expect(dto.partitaIva).toBe('12345678901');
  });

  it('rifiuta P.IVA corta', async () => expect(await errorsFor({ ...ente, partitaIva: '123' })).toContain('partitaIva'));
  it('rifiuta email invalida', async () => expect(await errorsFor({ ...ente, email: 'nope' })).toContain('email'));
  it('richiede privacy true', async () => expect(await errorsFor({ ...ente, privacy: false })).toContain('privacy'));
  it('rifiuta regione fuori lista', async () =>
    expect(await errorsFor({ ...ente, regione: 'Atlantide' })).toContain('regione'));
  it('richiede il settore per le aziende', async () =>
    expect(await errorsFor({ ...azienda, settore: undefined })).toContain('settore'));
  it('ignora la regione per le aziende', async () =>
    expect(await errorsFor({ ...azienda, regione: 'Atlantide' })).toEqual([]));
  it('rifiuta type sconosciuto', async () => expect(await errorsFor({ ...ente, type: 'altro' })).toContain('type'));
  it('accetta il campo honeypot', async () => expect(await errorsFor({ ...ente, website: 'x' })).toEqual([]));
});
