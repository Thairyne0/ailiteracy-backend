import { escapeHtml, layout, type MailContent } from './layout.js';

export type NotifyInternalInput = {
  type: 'ENTE' | 'AZIENDA';
  leadId: string;
  nomeEnte: string;
  regione?: string | null;
  settore?: string | null;
  referente: string;
  email: string;
  telefono: string;
  partitaIva: string;
  code?: string;
  frontendUrl: string;
};

export function notifyInternalMail(i: NotifyInternalInput): MailContent {
  const label = i.type === 'ENTE' ? 'ente di formazione' : 'azienda';
  const subject = `Nuovo lead ${label}: ${i.nomeEnte}`;
  const rows: [string, string][] = [
    ['Tipo', label],
    ['Nome', i.nomeEnte],
    [i.type === 'ENTE' ? 'Regione' : 'Settore', (i.type === 'ENTE' ? i.regione : i.settore) ?? '—'],
    ['P.IVA', i.partitaIva],
    ['Referente', i.referente],
    ['Email', i.email],
    ['Telefono', i.telefono],
    ...(i.code ? ([['Codice sconto', i.code]] as [string, string][]) : []),
    ['ID lead', i.leadId],
  ];
  const text = [subject, '', ...rows.map(([k, v]) => `${k}: ${v}`)].join('\n');
  const html = layout(
    subject,
    `<p style="margin:0 0 16px;font-weight:700">${escapeHtml(subject)}</p>
     <table cellpadding="6" style="border-collapse:collapse;font-size:15px">
       ${rows.map(([k, v]) => `<tr><td style="color:#6b6b74">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}
     </table>`,
    i.frontendUrl,
  );
  return { subject, text, html };
}
