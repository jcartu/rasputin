import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

function generateSecret(envVar, length = 64) {
  return process.env[envVar] || crypto.randomBytes(length).toString('hex');
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  apiToken: process.env.API_TOKEN || 'alfie-dev-token',
  
  jwt: {
    accessSecret: generateSecret('JWT_ACCESS_SECRET', 32),
    refreshSecret: generateSecret('JWT_REFRESH_SECRET', 32),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'alfie-backend',
    audience: process.env.JWT_AUDIENCE || 'alfie-api'
  },
  
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || ''
    },
    callbackUrl: process.env.OAUTH_CALLBACK_URL || ''
  },

  integrations: {
    tokenEncryptionSecret: process.env.INTEGRATIONS_TOKEN_SECRET || '',
    slack: {
      clientId: process.env.SLACK_CLIENT_ID || '',
      clientSecret: process.env.SLACK_CLIENT_SECRET || '',
      signingSecret: process.env.SLACK_SIGNING_SECRET || '',
      botToken: process.env.SLACK_BOT_TOKEN || '',
      redirectUri: process.env.SLACK_REDIRECT_URI || ''
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID || '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
      publicKey: process.env.DISCORD_PUBLIC_KEY || '',
      botToken: process.env.DISCORD_BOT_TOKEN || '',
      redirectUri: process.env.DISCORD_REDIRECT_URI || ''
    }
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    global: parseInt(process.env.RATE_LIMIT_GLOBAL || '1000', 10),
    anonymous: parseInt(process.env.RATE_LIMIT_ANONYMOUS || '30', 10),
    user: parseInt(process.env.RATE_LIMIT_USER || '100', 10),
    powerUser: parseInt(process.env.RATE_LIMIT_POWER_USER || '200', 10),
    admin: parseInt(process.env.RATE_LIMIT_ADMIN || '500', 10),
    service: parseInt(process.env.RATE_LIMIT_SERVICE || '1000', 10)
  },
  
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000', 10),
    csrfEnabled: process.env.CSRF_ENABLED !== 'false',
    corsStrictMode: process.env.CORS_STRICT_MODE === 'true'
  },
  
  admin: {
    defaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || 'Admin123!',
    autoCreate: process.env.ADMIN_AUTO_CREATE !== 'false'
  },
  
  openclawGatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:8080',
  openclawApiKey: process.env.OPENCLAW_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  
  email: {
    gmail: {
      clientId: process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
    },
    outlook: {
      clientId: process.env.OUTLOOK_CLIENT_ID || '',
      clientSecret: process.env.OUTLOOK_CLIENT_SECRET || '',
    },
  },
  
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173')
    .split(',')
    .map(origin => origin.trim()),
  
  workspaceRoot: process.env.WORKSPACE_ROOT || process.cwd(),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  
  wsHeartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10),
  wsClientTimeout: parseInt(process.env.WS_CLIENT_TIMEOUT || '60000', 10),
  
  backupDir: process.env.BACKUP_DIR || null,
  backupEncryptionKey: process.env.BACKUP_ENCRYPTION_KEY || null,
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'alfie:',
    defaultTTL: parseInt(process.env.REDIS_DEFAULT_TTL || '300', 10), // 5 minutes
  },
  
  observability: {
    enabled: process.env.OBSERVABILITY_ENABLED !== 'false',
    
    otel: {
      enabled: process.env.OTEL_ENABLED !== 'false',
      serviceName: process.env.OTEL_SERVICE_NAME || 'alfie-backend',
      serviceVersion: process.env.OTEL_SERVICE_VERSION || '1.0.0',
      environment: process.env.OTEL_ENVIRONMENT || process.env.NODE_ENV || 'development',
      exporterEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      debug: process.env.OTEL_DEBUG === 'true',
      consoleExporter: process.env.OTEL_CONSOLE_EXPORTER === 'true',
      batchSize: parseInt(process.env.OTEL_BATCH_SIZE || '2048', 10),
      batchExportSize: parseInt(process.env.OTEL_BATCH_EXPORT_SIZE || '512', 10),
      batchDelay: parseInt(process.env.OTEL_BATCH_DELAY || '5000', 10),
      exportTimeout: parseInt(process.env.OTEL_EXPORT_TIMEOUT || '30000', 10),
      metricExportInterval: parseInt(process.env.OTEL_METRIC_EXPORT_INTERVAL || '30000', 10),
    },
    
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty'),
    },
    
    sentry: {
      enabled: !!process.env.SENTRY_DSN && process.env.SENTRY_ENABLED !== 'false',
      dsn: process.env.SENTRY_DSN || '',
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || '1.0.0',
      sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '1.0'),
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
    },
    
    metrics: {
      enabled: process.env.METRICS_ENABLED !== 'false',
      prefix: process.env.METRICS_PREFIX || 'alfie_',
      updateInterval: parseInt(process.env.METRICS_UPDATE_INTERVAL || '15000', 10),
    },
    
    health: {
      memoryThresholdPercent: parseFloat(process.env.MEMORY_THRESHOLD_PERCENT || '90'),
      eventLoopLagThresholdMs: parseFloat(process.env.EVENT_LOOP_LAG_THRESHOLD_MS || '100'),
      maxStartupTimeMs: parseInt(process.env.MAX_STARTUP_TIME_MS || '30000', 10),
      slowRequestThresholdMs: parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS || '5000', 10),
    },
  },
};

export default config;
