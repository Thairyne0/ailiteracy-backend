import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LEAD_TYPES, type LeadTypeInput } from './create-lead.dto.js';

export class ListLeadsDto {
  @IsOptional()
  @IsIn(LEAD_TYPES)
  type?: LeadTypeInput;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
