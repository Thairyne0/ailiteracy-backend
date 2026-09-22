import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class SubjectDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Indica un indirizzo email valido' })
  email: string;
}
