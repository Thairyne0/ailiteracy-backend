import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Niente 0/O/1/I: il codice va letto e ricopiato a mano.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PREFIX = 'AILIT-';
const LENGTH = 6;
const MAX_ATTEMPTS = 5;

@Injectable()
export class DiscountCodeService {
  private readonly logger = new Logger(DiscountCodeService.name);

  constructor(private readonly prisma: PrismaService) {}

  generate(): string {
    let body = '';
    for (let i = 0; i < LENGTH; i++) body += ALPHABET[randomInt(ALPHABET.length)];
    return PREFIX + body;
  }

  /**
   * Un codice per ente: se la P.IVA ha già un codice lo restituisce,
   * altrimenti ne crea uno legato al lead corrente.
   */
  async getOrCreateForEnte(partitaIva: string, leadId: string): Promise<{ code: string; reused: boolean }> {
    const existing = await this.prisma.discountCode.findUnique({ where: { partitaIva } });
    if (existing) return { code: existing.code, reused: true };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const code = this.generate();
      try {
        const created = await this.prisma.discountCode.create({ data: { code, partitaIva, leadId } });
        return { code: created.code, reused: false };
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // Collisione sul codice o corsa sulla stessa P.IVA: rileggi e riprova.
        const raced = await this.prisma.discountCode.findUnique({ where: { partitaIva } });
        if (raced) return { code: raced.code, reused: true };
        this.logger.warn(`Collisione codice, tentativo ${attempt}/${MAX_ATTEMPTS}`);
      }
    }
    throw new Error('Impossibile generare un codice sconto univoco');
  }
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
