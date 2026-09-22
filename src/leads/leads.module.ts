import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { PdfModule } from '../pdf/pdf.module.js';
import { DiscountCodeService } from './discount-code.service.js';
import { LeadsController } from './leads.controller.js';
import { LeadsService } from './leads.service.js';

@Module({
  imports: [MailModule, PdfModule],
  controllers: [LeadsController],
  providers: [LeadsService, DiscountCodeService],
})
export class LeadsModule {}
