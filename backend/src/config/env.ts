import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3029),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  DATABASE_PATH: z.string().default('./data/umfrage.db'),
  CORS_ORIGIN: z.string().default('http://localhost:3030'),
});

export type Environment = z.infer<typeof environmentSchema>;

function loadEnvironment(): Environment {
  const result = environmentSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnvironment();
