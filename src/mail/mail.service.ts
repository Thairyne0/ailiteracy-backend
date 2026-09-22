import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';

export type Attachment = { filename: string; content: Buffer; contentType: string };
export type SendInput = { to: string; subject: string; text: string; html: string; attachments?: Attachment[] };

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly replyTo?: string;
  private readonly isJson: boolean;

  constructor(private readonly config: ConfigService<Env, true>) {
    const host = config.get('SMTP_HOST', { infer: true });
    this.isJson = host === 'json';
    this.from = config.get('MAIL_FROM', { infer: true });
    this.replyTo = config.get('MAIL_REPLY_TO', { infer: true });

    // "json" = trasporto finto per test e sviluppo: nessuna email parte.
    this.transporter = this.isJson
      ? nodemailer.createTransport({ jsonTransport: true })
      : nodemailer.createTransport({
          host,
          port: config.get('SMTP_PORT', { infer: true }),
          secure: config.get('SMTP_SECURE', { infer: true }),
          auth: { user: config.get('SMTP_USER', { infer: true }), pass: config.get('SMTP_PASS', { infer: true }) },
        });
  }

  async onModuleInit() {
    if (this.isJson || this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    try {
      await this.transporter.verify();
      this.logger.log('Connessione SMTP verificata');
    } catch (err) {
      // Non blocca l'avvio: le email falliranno e verranno registrate come FAILED.
      this.logger.error(`Verifica SMTP fallita: ${(err as Error).message}`);
    }
  }

  async send(input: SendInput): Promise<{ messageId: string }> {
    const info = await this.transporter.sendMail({
      from: this.from,
      replyTo: this.replyTo,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    });
    return { messageId: String(info.messageId ?? '') };
  }
}
