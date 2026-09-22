import { Module } from '@nestjs/common';
import { ListinoPdfService } from './listino-pdf.service.js';

@Module({
  providers: [ListinoPdfService],
  exports: [ListinoPdfService],
})
export class PdfModule {}
