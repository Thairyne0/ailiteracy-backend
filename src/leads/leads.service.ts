import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { type Lead, LeadType, EmailStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService, type Attachment } from '../mail/mail.service.js';
import { ListinoPdfService } from '../pdf/listino-pdf.service.js';
import { enteCodeMail } from '../mail/templates/ente-code.js';
import { aziendaConfermaMail } from '../mail/templates/azienda-conferma.js';
import { notifyInternalMail } from '../mail/templates/notify-internal.js';
import type { MailContent } from '../mail/templates/layout.js';
import { DiscountCodeService } from './discount-code.service.js';
import type { CreateLeadDto } from './dto/create-lead.dto.js';
import type { ListLeadsDto } from './dto/list-leads.dto.js';

export type CreateLeadResult = { ok: true; id: string; discountCode?: string };

const TEMPLATE = { ente: 'ente-code', azienda: 'azienda-conferma', internal: 'notify-internal' } as const;

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);
  private readonly frontendUrl: string;
  private readonly notifyTo?: string;
  private readonly discountPercent?: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly pdf: ListinoPdfService,
    private readonly codes: DiscountCodeService,
    config: ConfigService<Env, true>,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', { infer: true });
    this.notifyTo = config.get('LEAD_NOTIFY_TO', { infer: true });
    this.discountPercent = config.get('DISCOUNT_PERCENT', { infer: true });
  }

  async create(dto: CreateLeadDto): Promise<CreateLeadResult> {
    const type = dto.type === 'ente' ? LeadType.ENTE : LeadType.AZIENDA;
    const lead = await this.prisma.lead.create({
      data: {
        type,
        nomeEnte: dto.nomeEnte,
        regione: type === LeadType.ENTE ? dto.regione : null,
        settore: type === LeadType.AZIENDA ? dto.settore : null,
        partitaIva: dto.partitaIva,
        referente: dto.referente,
        email: dto.email,
        telefono: dto.telefono,
        privacyAcceptedAt: new Date(),
        privacyVersion: dto.privacyVersion ?? null,
      },
    });
    this.logger.log(`Lead ${lead.id} creato (${type})`);

    let discountCode: string | undefined;
    if (type === LeadType.ENTE) {
      const res = await this.codes.getOrCreateForEnte(lead.partitaIva, lead.id);
      discountCode = res.code;
      this.logger.log(`Lead ${lead.id}: codice ${res.reused ? 'riusato' : 'nuovo'}`);
    }

    await this.sendForLead(lead, discountCode);
    return { ok: true, id: lead.id, discountCode };
  }

  async findAll(query: ListLeadsDto) {
    const where = query.type ? { type: query.type === 'ente' ? LeadType.ENTE : LeadType.AZIENDA } : {};
    const [total, items] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          discountCode: { select: { code: true, issuedAt: true, redeemedAt: true } },
          emails: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, template: true, createdAt: true, error: true } },
        },
      }),
    ]);
    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      items: items.map(({ emails, ...lead }) => ({ ...lead, lastEmail: emails[0] ?? null })),
    };
  }

  async resend(id: string): Promise<{ ok: true; discountCode?: string }> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead non trovato');
    let discountCode: string | undefined;
    if (lead.type === LeadType.ENTE) {
      discountCode = (await this.codes.getOrCreateForEnte(lead.partitaIva, lead.id)).code;
    }
    await this.sendForLead(lead, discountCode);
    return { ok: true, discountCode };
  }

  /** Art. 15 GDPR: tutti i dati associati a un indirizzo email. */
  async exportSubject(email: string) {
    const normalized = email.trim().toLowerCase();
    const leads = await this.prisma.lead.findMany({
      where: { email: { equals: normalized, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
      include: { discountCode: true, emails: { orderBy: { createdAt: 'asc' } } },
    });
    return { email: normalized, exportedAt: new Date().toISOString(), leads };
  }

  /** Art. 17 GDPR: cancella lead, log email e codici associati a un indirizzo email. */
  async eraseSubject(email: string): Promise<{ deletedLeads: number; deletedCodes: number }> {
    const normalized = email.trim().toLowerCase();
    return this.prisma.$transaction(async (tx) => {
      const leads = await tx.lead.findMany({
        where: { email: { equals: normalized, mode: 'insensitive' } },
        select: { id: true },
      });
      const ids = leads.map((l) => l.id);
      if (ids.length === 0) return { deletedLeads: 0, deletedCodes: 0 };
      const codes = await tx.discountCode.deleteMany({ where: { leadId: { in: ids } } });
      await tx.emailLog.deleteMany({ where: { leadId: { in: ids } } });
      const deleted = await tx.lead.deleteMany({ where: { id: { in: ids } } });
      this.logger.log(`Cancellazione su richiesta: ${deleted.count} lead, ${codes.count} codici`);
      return { deletedLeads: deleted.count, deletedCodes: codes.count };
    });
  }

  /** Cancella i lead più vecchi di `months` mesi (retention dichiarata nell'informativa). */
  async purgeOlderThan(months: number): Promise<{ deletedLeads: number; deletedCodes: number }> {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return this.prisma.$transaction(async (tx) => {
      const leads = await tx.lead.findMany({ where: { createdAt: { lt: cutoff } }, select: { id: true } });
      const ids = leads.map((l) => l.id);
      if (ids.length === 0) return { deletedLeads: 0, deletedCodes: 0 };
      const codes = await tx.discountCode.deleteMany({ where: { leadId: { in: ids } } });
      await tx.emailLog.deleteMany({ where: { leadId: { in: ids } } });
      const deleted = await tx.lead.deleteMany({ where: { id: { in: ids } } });
      return { deletedLeads: deleted.count, deletedCodes: codes.count };
    });
  }

  /** Email al richiedente (+ eventuale copia interna). Un fallimento non blocca la risposta. */
  private async sendForLead(lead: Lead, discountCode?: string): Promise<void> {
    if (lead.type === LeadType.ENTE && discountCode) {
      const attachments = await this.buildListino(lead, discountCode);
      const content = enteCodeMail({
        referente: lead.referente,
        nomeEnte: lead.nomeEnte,
        code: discountCode,
        discountPercent: this.discountPercent,
        frontendUrl: this.frontendUrl,
        hasAttachment: attachments.length > 0,
      });
      await this.deliver(lead, lead.email, TEMPLATE.ente, content, attachments);
    } else {
      const content = aziendaConfermaMail({
        referente: lead.referente,
        nomeEnte: lead.nomeEnte,
        settore: lead.settore ?? undefined,
        frontendUrl: this.frontendUrl,
      });
      await this.deliver(lead, lead.email, TEMPLATE.azienda, content);
    }

    if (this.notifyTo) {
      const content = notifyInternalMail({
        type: lead.type,
        leadId: lead.id,
        nomeEnte: lead.nomeEnte,
        regione: lead.regione,
        settore: lead.settore,
        referente: lead.referente,
        email: lead.email,
        telefono: lead.telefono,
        partitaIva: lead.partitaIva,
        code: discountCode,
        frontendUrl: this.frontendUrl,
      });
      await this.deliver(lead, this.notifyTo, TEMPLATE.internal, content);
    }
  }

  private async buildListino(lead: Lead, code: string): Promise<Attachment[]> {
    try {
      const content = await this.pdf.build({ nomeEnte: lead.nomeEnte, code, discountPercent: this.discountPercent });
      return [{ filename: `listino-ai-literacy-${code}.pdf`, content, contentType: 'application/pdf' }];
    } catch (err) {
      this.logger.error(`Lead ${lead.id}: generazione PDF fallita: ${(err as Error).message}`);
      return [];
    }
  }

  private async deliver(lead: Lead, to: string, template: string, content: MailContent, attachments?: Attachment[]) {
    try {
      await this.mail.send({ to, attachments, ...content });
      await this.prisma.emailLog.create({ data: { leadId: lead.id, to, template, status: EmailStatus.SENT } });
      this.logger.log(`Lead ${lead.id}: email ${template} inviata`);
    } catch (err) {
      const error = (err as Error).message.slice(0, 500);
      await this.prisma.emailLog.create({ data: { leadId: lead.id, to, template, status: EmailStatus.FAILED, error } });
      this.logger.error(`Lead ${lead.id}: email ${template} fallita: ${error}`);
    }
  }
}
