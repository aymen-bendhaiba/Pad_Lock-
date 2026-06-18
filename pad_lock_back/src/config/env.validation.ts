type Env = Record<string, string | undefined>;

const required = (env: Env, key: string): string => {
  const value = env[key];

  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const toBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return ['true', '1', 'yes'].includes(value.toLowerCase());
};

export function validateEnv(env: Env) {
  const jwtSecret = required(env, 'JWT_SECRET');
  const databaseUrl = env.DATABASE_URL?.trim();

  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  return {
    ...env,
    NODE_ENV: env.NODE_ENV ?? 'development',
    PORT: Number(env.PORT ?? 3000),
    DATABASE_URL: databaseUrl,
    DB_HOST: databaseUrl ? env.DB_HOST : required(env, 'DB_HOST'),
    DB_PORT: Number(env.DB_PORT ?? 5432),
    DB_USER: databaseUrl ? env.DB_USER : required(env, 'DB_USER'),
    DB_PASSWORD: databaseUrl ? env.DB_PASSWORD : required(env, 'DB_PASSWORD'),
    DB_NAME: databaseUrl ? env.DB_NAME : required(env, 'DB_NAME'),
    DB_SSL: toBoolean(env.DB_SSL, Boolean(databaseUrl)),
    DB_SYNCHRONIZE: toBoolean(env.DB_SYNCHRONIZE),
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: env.JWT_EXPIRES_IN ?? '15m',
    TCP_HOST: env.TCP_HOST ?? '0.0.0.0',
    TCP_PORT: Number(env.TCP_PORT ?? 8989),
    TCP_COMMAND_TIMEOUT_MS: Number(env.TCP_COMMAND_TIMEOUT_MS ?? 60000),
  };
}
