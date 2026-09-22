import { ListinoPdfService } from './listino-pdf.service.js';

describe('ListinoPdfService', () => {
  it('produce un PDF valido con il codice', async () => {
    const buf = await new ListinoPdfService().build({ nomeEnte: 'Ente Test', code: 'AILIT-ABC234', discountPercent: 10 });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(1000);
  });
});
