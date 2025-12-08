import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();
const envSchema = z.object({
    PORT: z.string().default('3000'),
    APP_MODE: z.enum(['demo', 'production']).default('demo'),
    OPENAI_API_KEY: z.string().min(1),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    N8N_WEBHOOK_BASE_URL: z.string().url().optional(),
});
export const config = envSchema.parse(process.env);
