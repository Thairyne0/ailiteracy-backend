import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { company } from '../config/company.js';
import { LISTINO_NOTES, LISTINO_TIERS } from '../config/listino.js';

export type ListinoInput = { nomeEnte: string; code: string; date?: Date; discountPercent?: number };

const NAVY = '#1d1d24';
const BLUE = '#1b5fe0';
const MUTED = '#6b6b74';
const RULE = '#e3e2dc';

function eur(n: number): string {
  return `${n.toLocaleString('it-IT')} €`;
}

@Injectable()
export class ListinoPdfService {
  build(input: ListinoInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: 'Listino riservato enti di formazione', Author: company.legalName } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const date = (input.date ?? new Date()).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
      const left = doc.page.margins.left;
      const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // Intestazione
      doc.font('Helvetica-Bold').fontSize(18).fillColor(NAVY).text(company.brand, left, 56);
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`${company.legalName} · P.IVA ${company.vat}`);
      doc.moveDown(2);

      doc.font('Helvetica').fontSize(11).fillColor(MUTED).text('Kit AI Literacy');
      doc.font('Helvetica-Bold').fontSize(24).fillColor(NAVY).text('Listino riservato enti di formazione');
      doc.moveDown(1);

      // Intestatario e codice
      doc.font('Helvetica').fontSize(11).fillColor(NAVY);
      doc.text(`Riservato a: ${input.nomeEnte}`);
      doc.text(`Data: ${date}`);
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('Codice sconto personale');
      doc.font('Helvetica-Bold').fontSize(22).fillColor(BLUE).text(input.code);
      if (input.discountPercent) {
        doc.font('Helvetica').fontSize(10).fillColor(NAVY).text(`Sconto del ${input.discountPercent}% sul primo ordine.`);
      }
      doc.moveDown(1.5);

      // Tabella fasce
      const cols = [0.34, 0.33, 0.33].map((f) => Math.floor(width * f));
      const rowH = 26;
      let y = doc.y;
      const cell = (text: string, x: number, w: number, align: 'left' | 'right', bold = false, color = NAVY) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11).fillColor(color).text(text, x, y + 7, { width: w - 12, align });
      };
      doc.moveTo(left, y).lineTo(left + width, y).lineWidth(1).strokeColor(NAVY).stroke();
      cell('Fascia (corsi)', left, cols[0]!, 'left', true, MUTED);
      cell('Prezzo per corso', left + cols[0]!, cols[1]!, 'right', true, MUTED);
      cell('Esempio a fine fascia', left + cols[0]! + cols[1]!, cols[2]!, 'right', true, MUTED);
      y += rowH;
      let cumulative = 0;
      for (const t of LISTINO_TIERS) {
        cumulative += (t.max - t.min + 1) * t.price;
        doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.5).strokeColor(RULE).stroke();
        cell(`${t.min}–${t.max}`, left, cols[0]!, 'left');
        cell(eur(t.price), left + cols[0]!, cols[1]!, 'right', true);
        cell(`${t.max} corsi: ${eur(cumulative)}`, left + cols[0]! + cols[1]!, cols[2]!, 'right', false, MUTED);
        y += rowH;
      }
      doc.moveTo(left, y).lineTo(left + width, y).lineWidth(1).strokeColor(NAVY).stroke();
      doc.y = y + 16;

      // Note
      doc.font('Helvetica').fontSize(9.5).fillColor(MUTED);
      for (const n of LISTINO_NOTES) doc.text(`• ${n}`, left, doc.y, { width });
      doc.moveDown(1);
      doc.text('"Esempio a fine fascia": costo totale acquistando esattamente il numero massimo di corsi della fascia, con scaglioni progressivi.', left, doc.y, { width });

      // Footer
      const footerY = doc.page.height - doc.page.margins.bottom - 40;
      doc.moveTo(left, footerY).lineTo(left + width, footerY).lineWidth(0.5).strokeColor(RULE).stroke();
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(
        `${company.legalName} · ${company.address}, ${company.city} · P.IVA ${company.vat} · ${company.email} · ${company.phone}`,
        left,
        footerY + 8,
        { width },
      );

      doc.end();
    });
  }
}
