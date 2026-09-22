import { company } from '../../config/company.js';

export type MailContent = { subject: string; text: string; html: string };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function legalFooterText(frontendUrl: string): string {
  return [
    '—',
    company.legalName,
    `${company.address}, ${company.city}`,
    `P.IVA ${company.vat} · ${company.email} · ${company.phone}`,
    `Informativa privacy: ${frontendUrl}/privacy`,
    'Hai ricevuto questa email perché hai compilato un modulo sul nostro sito.',
  ].join('\n');
}

export function legalFooterHtml(frontendUrl: string): string {
  return `
    <p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #e3e2dc;font-size:12px;line-height:1.6;color:#6b6b74">
      ${escapeHtml(company.legalName)}<br>
      ${escapeHtml(company.address)}, ${escapeHtml(company.city)}<br>
      P.IVA ${company.vat} · <a href="mailto:${company.email}" style="color:#6b6b74">${company.email}</a> · ${company.phone}<br>
      <a href="${frontendUrl}/privacy" style="color:#6b6b74">Informativa privacy</a><br>
      Hai ricevuto questa email perché hai compilato un modulo sul nostro sito.
    </p>`;
}

/** Wrapper HTML sobrio, coerente con la landing: Inter di sistema, blu #1B5FE0. */
export function layout(title: string, bodyHtml: string, frontendUrl: string): string {
  return `<!doctype html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f5f4f0;font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d1d24">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f4f0;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffefb;padding:40px 36px">
        <tr><td style="font-size:20px;font-weight:700;letter-spacing:-0.01em;padding-bottom:24px">${escapeHtml(company.brand)}</td></tr>
        <tr><td style="font-size:16px;line-height:1.6">${bodyHtml}${legalFooterHtml(frontendUrl)}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
