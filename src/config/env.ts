import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.email().optional());

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  TRUST_PROXY: bool,
  API_KEY: z.string().min(16, 'API_KEY deve avere almeno 16 caratteri'),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_SECURE: bool,
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().min(3),
  MAIL_REPLY_TO: optionalEmail,

  FRONTEND_URL: z.url(),
  LEAD_NOTIFY_TO: optionalEmail,
  DISCOUNT_PERCENT: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int().min(1).max(100).optional()),
});

export type Env = z.infer<typeof envSchema>;

/** Usata da ConfigModule: blocca l'avvio se l'ambiente non è valido. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Configurazione non valida:\n  ${issues}`);
  }
  return parsed.data;
}
