import { escapeHtml, layout, legalFooterText, type MailContent } from './layout.js';

export type AziendaConfermaInput = {
  referente: string;
  nomeEnte: string;
  settore?: string;
  frontendUrl: string;
};

export function aziendaConfermaMail(i: AziendaConfermaInput): MailContent {
  const subject = 'Abbiamo ricevuto la tua richiesta di preventivo';
  const text = [
    `Gentile ${i.referente},`,
    '',
    `abbiamo ricevuto la richiesta di preventivo per il Kit AI Literacy da parte di ${i.nomeEnte}${i.settore ? ` (settore: ${i.settore})` : ''}.`,
    '',
    'Un nostro consulente ti ricontatta entro 24 ore lavorative ai recapiti che ci hai lasciato.',
    '',
    'Per qualsiasi domanda rispondi a questa email.',
    '',
    'Generazione Ai',
    '',
    legalFooterText(i.frontendUrl),
  ].join('\n');

  const html = layout(
    subject,
    `
    <p style="margin:0 0 16px">Gentile ${escapeHtml(i.referente)},</p>
    <p style="margin:0 0 16px">abbiamo ricevuto la richiesta di preventivo per il Kit AI Literacy da parte di <strong>${escapeHtml(i.nomeEnte)}</strong>${i.settore ? ` (settore: ${escapeHtml(i.settore)})` : ''}.</p>
    <p style="margin:0 0 16px">Un nostro consulente ti ricontatta entro <strong>24 ore lavorative</strong> ai recapiti che ci hai lasciato.</p>
    <p style="margin:0">Per qualsiasi domanda rispondi a questa email.</p>`,
    i.frontendUrl,
  );

  return { subject, text, html };
}
