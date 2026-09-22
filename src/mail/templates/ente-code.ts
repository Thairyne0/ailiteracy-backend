import { escapeHtml, layout, legalFooterText, type MailContent } from './layout.js';

export type EnteCodeInput = {
  referente: string;
  nomeEnte: string;
  code: string;
  discountPercent?: number;
  frontendUrl: string;
  hasAttachment: boolean;
};

export function enteCodeMail(i: EnteCodeInput): MailContent {
  const subject = 'Il tuo codice sconto e il listino riservato AI Literacy';
  const sconto = i.discountPercent ? ` Ti dà diritto al ${i.discountPercent}% di sconto sul primo ordine.` : '';
  const listino = i.hasAttachment
    ? 'In allegato trovi il listino riservato agli enti di formazione.'
    : 'Il listino riservato agli enti di formazione ti verrà inviato a breve da un nostro referente.';

  const text = [
    `Gentile ${i.referente},`,
    '',
    `grazie per l'interesse di ${i.nomeEnte} nel Kit AI Literacy di Generazione Ai.`,
    '',
    `Il tuo codice sconto personale è: ${i.code}`,
    `Conservalo e comunicalo al nostro referente al momento dell'ordine.${sconto}`,
    '',
    listino,
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
    <p style="margin:0 0 16px">grazie per l'interesse di <strong>${escapeHtml(i.nomeEnte)}</strong> nel Kit AI Literacy di Generazione Ai.</p>
    <p style="margin:0 0 8px">Il tuo codice sconto personale:</p>
    <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:0.04em;color:#1b5fe0">${escapeHtml(i.code)}</p>
    <p style="margin:0 0 16px">Conservalo e comunicalo al nostro referente al momento dell'ordine.${escapeHtml(sconto)}</p>
    <p style="margin:0 0 16px">${escapeHtml(listino)}</p>
    <p style="margin:0">Per qualsiasi domanda rispondi a questa email.</p>`,
    i.frontendUrl,
  );

  return { subject, text, html };
}
