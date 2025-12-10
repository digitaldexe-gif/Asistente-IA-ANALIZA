import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Define schema for runtime validation only - NO DEFAULTS for secrets
const envSchema = z.object({
    PORT: z.string().default('3000'),
    APP_MODE: z.enum(['demo', 'production']).default('demo'),
    // REQUIRED: Must be set in Railway/Environment
    OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY must be set in environment variables"),
    VOICE_PROVIDER: z.string().default('voximplant'),
    // Optional variables
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    N8N_WEBHOOK_BASE_URL: z.string().url().optional(),
    DATABASE_URL: z.string().optional(),
    JWT_SECRET: z.string().optional(),
});

// Parse and export
// This will throw an error at startup if variables are missing
export const config = envSchema.parse(process.env);
