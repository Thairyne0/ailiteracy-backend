import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiKeyGuard } from '../common/api-key.guard.js';
import { CreateLeadDto } from './dto/create-lead.dto.js';
import { ListLeadsDto } from './dto/list-leads.dto.js';
import { LeadsService } from './leads.service.js';

@Controller('leads')
@UseGuards(ApiKeyGuard)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async create(@Body() dto: CreateLeadDto) {
    // Honeypot compilato: risposta identica a un successo, nessun salvataggio.
    if (dto.website) return { ok: true };
    const { id: _id, ...result } = await this.leads.create(dto);
    return result;
  }

  @Get()
  findAll(@Query() query: ListLeadsDto) {
    return this.leads.findAll(query);
  }

  @Post(':id/resend')
  @HttpCode(200)
  resend(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.leads.resend(id);
  }
}
