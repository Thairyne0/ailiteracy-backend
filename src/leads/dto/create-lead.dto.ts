import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { REGIONI, SETTORI } from '../../config/listino.js';

export const LEAD_TYPES = ['ente', 'azienda'] as const;
export type LeadTypeInput = (typeof LEAD_TYPES)[number];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateLeadDto {
  @IsIn(LEAD_TYPES, { message: 'type deve essere "ente" o "azienda"' })
  type: LeadTypeInput;

  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Inserisci il nome' })
  @MaxLength(200)
  nomeEnte: string;

  @ValidateIf((o: CreateLeadDto) => o.type === 'ente')
  @IsIn(REGIONI, { message: 'Seleziona una regione' })
  regione?: (typeof REGIONI)[number];

  @ValidateIf((o: CreateLeadDto) => o.type === 'azienda')
  @IsIn(SETTORI, { message: 'Seleziona un settore' })
  settore?: (typeof SETTORI)[number];

  /** Normalizzata a 11 cifre: gli spazi vengono rimossi prima della validazione. */
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s/g, '') : value))
  @IsString()
  @Matches(/^\d{11}$/, { message: 'La partita IVA deve avere 11 cifre' })
  partitaIva: string;

  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Inserisci nome e cognome' })
  @MaxLength(200)
  referente: string;

  @Transform(trim)
  @IsEmail({}, { message: 'Inserisci un indirizzo email valido' })
  @MaxLength(254)
  email: string;

  @Transform(trim)
  @IsString()
  @MinLength(6, { message: 'Inserisci un numero valido' })
  @MaxLength(30)
  @Matches(/^[+\d\s]+$/, { message: 'Usa solo cifre, spazi e +' })
  telefono: string;

  @IsBoolean()
  @Equals(true, { message: "Devi dichiarare di aver letto l'informativa privacy" })
  privacy: boolean;

  /** Honeypot anti-spam: se valorizzato la richiesta viene ignorata. */
  @IsOptional()
  @IsString()
  website?: string;
}
