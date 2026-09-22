import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { Env } from '../config/env.js';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly expected: Buffer;

  constructor(config: ConfigService<Env, true>) {
    this.expected = Buffer.from(config.get('API_KEY', { infer: true }));
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.header('x-api-key');
    const provided = Buffer.from(typeof header === 'string' ? header : '');
    const ok = provided.length === this.expected.length && timingSafeEqual(provided, this.expected);
    if (!ok) throw new UnauthorizedException('API key mancante o non valida');
    return true;
  }
}
