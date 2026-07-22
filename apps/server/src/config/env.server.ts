import { z } from 'zod';

const booleanFromString = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((v) => v === 'true');
const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().min(0);
const floatBetween0and1 = z.coerce.number().min(0).max(1);

const LogLevel = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']);
const AppEnv = z.enum(['development', 'staging', 'production', 'on-premise']);
const NodeEnv = z.enum(['development', 'test', 'staging', 'production']);
const SearchProvider = z.enum(['postgres', 'meilisearch']);
const OcrEngine = z.enum(['tesseract', 'service']);

export const serverEnvSchema = z
  .object({
    // ─── Core ─────────────────────────────────────────────────────────────
    NODE_ENV: NodeEnv,
    APP_ENV: AppEnv,
    APP_NAME: z.string().min(1).default('Batac City LGU Platform'),
    APP_VERSION: z.string().default('0.0.0'),
    APP_URL: z.string().url(),
    API_URL: z.string().url(),
    APP_PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
    APP_HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: LogLevel.default('info'),
    LOG_PRETTY: booleanFromString('false'),
    LOG_REDACT_PATHS: z
      .string()
      .default('["req.headers.authorization","req.headers.cookie","*.password","*.secret"]')
      .transform((s) => JSON.parse(s) as string[]),
    LOG_DESTINATION: z.string().default('stdout'),
    HEALTH_CHECK_PATH: z.string().default('/health'),
    CORS_ALLOWED_ORIGINS: z.string().transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
    CITY_ID: z.string().uuid(),
    TRUST_PROXY: booleanFromString('false'),
    APP_INSTANCE_ID: z
      .string()
      .min(1)
      .default(() => crypto.randomUUID()),

    // ─── Database ────────────────────────────────────────────────────────
    DATABASE_URL_APP: z.string().url(),
    DATABASE_URL_AUDIT: z.string().url(),
    DATABASE_URL_MIGRATE: z.string().url().optional(),
    DB_POOL_MIN: nonNegativeInt.default(2),
    DB_POOL_MAX: positiveInt.default(10),
    DB_POOL_IDLE_TIMEOUT_MS: positiveInt.default(30000),
    DB_POOL_ACQUIRE_TIMEOUT_MS: positiveInt.default(10000),
    DB_POOL_CONNECTION_TIMEOUT_MS: positiveInt.default(5000),
    DB_STATEMENT_TIMEOUT_MS: positiveInt.default(30000),
    DRIZZLE_VERBOSE: booleanFromString('false'),

    // ─── Authentication ───────────────────────────────────────────────────
    AUTH_JWT_ACCESS_SECRET: z.string().min(32),
    AUTH_JWT_REFRESH_SECRET: z.string().min(32),
    AUTH_JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    AUTH_JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
    AUTH_JWT_ALGORITHM: z.enum(['HS256', 'RS256', 'ES256']).default('HS256'),
    AUTH_COOKIE_SECURE: booleanFromString('true'),
    AUTH_COOKIE_SAMESITE: z.enum(['Strict', 'Lax', 'None']).default('Strict'),
    AUTH_COOKIE_DOMAIN: z.string().optional(),
    AUTH_ACCESS_TOKEN_COOKIE_NAME: z.string().default('__Host-bat_at'),
    AUTH_REFRESH_TOKEN_COOKIE_NAME: z.string().default('__Host-bat_rt'),
    AUTH_SESSION_INACTIVITY_TIMEOUT_MS: positiveInt.default(1800000),
    AUTH_SESSION_WARNING_THRESHOLD_MS: positiveInt.default(1500000),
    AUTH_MAX_CONCURRENT_SESSIONS: positiveInt.default(1),
    AUTH_MFA_TOTP_ENABLED: booleanFromString('false'),
    AUTH_MFA_TOTP_ISSUER: z.string().default('Batac City LGU'),
    AUTH_MFA_TOTP_WINDOW: nonNegativeInt.default(1),

    // ─── Argon2id ─────────────────────────────────────────────────────────
    ARGON2_MEMORY_COST: positiveInt.default(65536),
    ARGON2_TIME_COST: positiveInt.default(3),
    ARGON2_PARALLELISM: positiveInt.default(1),
    ARGON2_HASH_LENGTH: positiveInt.default(32),

    // ─── Audit Log ────────────────────────────────────────────────────────
    AUDIT_HMAC_SECRET: z.string().min(32),
    AUDIT_GENESIS_HASH: z.string().length(64).default('0'.repeat(64)),
    AUDIT_CHAIN_VERIFY_ON_READ: booleanFromString('true'),
    AUDIT_RETENTION_DAYS: positiveInt.default(3650),
    AUDIT_TSA_ENABLED: booleanFromString('false'),
    AUDIT_TSA_URL: z.string().url().optional(),
    AUDIT_EXPORT_ENABLED: booleanFromString('false'),
    AUDIT_EXPORT_DESTINATION: z.enum(['s3']).default('s3'),

    // ─── S3-Compatible Storage ────────────────────────────────────────────
    S3_ENDPOINT: z.string().url(),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_REGION: z.string().default('auto'),
    S3_FORCE_PATH_STYLE: booleanFromString('false'),
    S3_UPLOAD_MAX_SIZE_MB: positiveInt.default(25),
    S3_SIGNED_URL_EXPIRES_S: positiveInt.default(300),
    S3_UPLOAD_PRESIGN_EXPIRES_S: positiveInt.default(600),
    S3_ALLOWED_MIME_TYPES: z
      .string()
      .default(
        'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg',
      )
      .transform((s) => s.split(',').map((m) => m.trim())),
    S3_BACKUP_BUCKET: z.string().optional(),
    S3_BACKUP_ACCESS_KEY: z.string().optional(),
    S3_BACKUP_SECRET_KEY: z.string().optional(),
    S3_BACKUP_ENDPOINT: z.string().url().optional(),

    // ─── SMTP ─────────────────────────────────────────────────────────────
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_SECURE: booleanFromString('false'),
    SMTP_USER: z.string().min(1),
    SMTP_PASSWORD: z.string().min(1),
    SMTP_FROM: z.string().email(),
    SMTP_FROM_NAME: z.string().default('Batac City LGU'),
    SMTP_REJECT_UNAUTHORIZED: booleanFromString('true'),
    SMTP_POOL: booleanFromString('true'),
    SMTP_MAX_CONNECTIONS: positiveInt.default(5),
    SMTP_MAX_MESSAGES: positiveInt.default(100),
    SMTP_DEBUG: booleanFromString('false'),

    // ─── OCR ──────────────────────────────────────────────────────────────
    OCR_ENGINE: OcrEngine.default('tesseract'),
    OCR_SERVICE_URL: z.string().url().optional(),
    OCR_SERVICE_API_KEY: z.string().optional(),
    OCR_LANGUAGE_PACKS: z.string().default('eng+fil'),
    OCR_WORKER_COUNT: positiveInt.default(2),
    OCR_TIMEOUT_MS: positiveInt.default(60000),
    OCR_MAX_FILE_SIZE_MB: positiveInt.default(25),
    OCR_QUALITY_THRESHOLD: floatBetween0and1.default(0.6),
    OCR_QUEUE_CONCURRENCY: positiveInt.default(3),
    OCR_MIGRATION_ENABLED: booleanFromString('false'),
    OCR_MIGRATION_BATCH_SIZE: positiveInt.default(50),

    // ─── Search (Phase 1 = postgres; Phase 2 fields optional now) ────────
    SEARCH_PROVIDER: SearchProvider.default('postgres'),
    SEARCH_FTS_LANGUAGE: z.string().default('english'),
    SEARCH_MEILISEARCH_URL: z.string().url().optional(),
    SEARCH_MEILISEARCH_MASTER_KEY: z.string().optional(),
    SEARCH_MEILISEARCH_INDEX_PREFIX: z.string().default('batac_'),
    SEARCH_SYNC_BATCH_SIZE: positiveInt.default(100),
    SEARCH_SYNC_INTERVAL_MS: positiveInt.default(5000),
    SEARCH_SYNC_ON_STARTUP: booleanFromString('false'),

    // ─── SSE & Notifications ──────────────────────────────────────────────
    SSE_HEARTBEAT_INTERVAL_MS: positiveInt.default(30000),
    SSE_CONNECTION_TIMEOUT_MS: positiveInt.default(3600000),
    SSE_MAX_CONNECTIONS_PER_USER: positiveInt.default(3),
    SSE_RETRY_MS: positiveInt.default(3000),
    NOTIF_RETENTION_DAYS: positiveInt.default(30),
    NOTIF_MAX_UNREAD_PER_USER: positiveInt.default(200),

    // ─── OpenTelemetry ────────────────────────────────────────────────────
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:5080/api/default'),
    OTEL_EXPORTER_OTLP_HEADERS: z
      .string()
      .default('Authorization=Basic YWRtaW5AYmF0YWMuZ292LnBoOkNvbXBsZXhQYXNzd29yZDEyMyE='),

    // ─── OpenObserve Query API ───
    OPENOBSERVE_QUERY_URL: z.string().url(),
    OPENOBSERVE_QUERY_USER: z.string().min(1),
    OPENOBSERVE_QUERY_PASSWORD: z.string().min(1),

    // ─── Sentry ───────────────────────────────────────────────────────────
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ENVIRONMENT: z.string().optional(),
    SENTRY_RELEASE: z.string().optional(),
    SENTRY_TRACES_SAMPLE_RATE: floatBetween0and1.default(0.1),
    SENTRY_PROFILES_SAMPLE_RATE: floatBetween0and1.default(0.0),

    // ─── Background Jobs ──────────────────────────────────────────────────
    PGBOSS_SCHEMA: z.string().default('pgboss'),
    PGBOSS_ARCHIVE_COMPLETED_AFTER_SECONDS: positiveInt.default(86400),
    PGBOSS_DELETE_AFTER_DAYS: positiveInt.default(7),
    JOB_WORKER_CONCURRENCY: positiveInt.default(5),
    JOB_RETRY_LIMIT: nonNegativeInt.default(3),
    JOB_RETRY_DELAY_S: nonNegativeInt.default(60),
    JOB_EXPIRY_SECONDS: positiveInt.default(3600),

    // ─── Cron Expressions ─────────────────────────────────────────────────
    CRON_SLA_CHECK: z.string().default('*/15 * * * *'),
    CRON_MAYOR_LAPSE_CHECK: z.string().default('0 6 * * *'),
    CRON_PANLALAWIGAN_TIMER_CHECK: z.string().default('0 7 * * *'),
    CRON_SESSION_CLEANUP: z.string().default('0 3 * * *'),
    CRON_NOTIFICATION_CLEANUP: z.string().default('0 2 * * *'),
    CRON_AUDIT_EXPORT: z.string().default('0 1 1 * *'),
    CRON_DELEGATION_EXPIRY_CHECK: z.string().default('*/5 * * * *'),
    CRON_BACKUP_DATABASE: z.string().default('0 0 * * *'),
    CRON_ORDER_OF_BUSINESS_ALERT: z.string().default('0 9 * * 4'),

    // ─── Rate Limiting ────────────────────────────────────────────────────
    RATE_AUTH_MAX: positiveInt.default(10),
    RATE_AUTH_WINDOW_MS: positiveInt.default(900000),
    RATE_API_MAX: positiveInt.default(200),
    RATE_API_WINDOW_MS: positiveInt.default(60000),
    RATE_PORTAL_MAX: positiveInt.default(60),
    RATE_PORTAL_WINDOW_MS: positiveInt.default(60000),
    RATE_UPLOAD_MAX: positiveInt.default(20),
    RATE_UPLOAD_WINDOW_MS: positiveInt.default(60000),

    // ─── QR & Document Numbering ──────────────────────────────────────────
    QR_BASE_URL: z.string().url(),
    QR_ERROR_CORRECTION_LEVEL: z.enum(['L', 'M', 'Q', 'H']).default('M'),
    QR_MODULE_SIZE: positiveInt.default(4),
    QR_COVER_SHEETS_PER_PAGE: positiveInt.default(4),
    DOC_SP_ORDINAL: z.coerce.number().int().min(1).max(99).default(7),
    DOC_NUMBER_CITY_ID: z.string().uuid().optional(),
    DOC_TRACKING_NUMBER_PREFIX: z.string().default('DTS'),

    // ─── i18n ─────────────────────────────────────────────────────────────
    I18N_DEFAULT_LOCALE: z.string().default('en'),
    I18N_SUPPORTED_LOCALES: z
      .string()
      .default('en,fil,ilo')
      .transform((s) => s.split(',').map((l) => l.trim())),
    I18N_FALLBACK_LOCALE: z.string().default('en'),

    // ─── Feature Flags ────────────────────────────────────────────────────
    FEATURE_MFA_ENABLED: booleanFromString('false'),
    FEATURE_OCR_ENABLED: booleanFromString('true'),
    FEATURE_MEILISEARCH_ENABLED: booleanFromString('false'),
    FEATURE_CITIZEN_PORTAL_ENABLED: booleanFromString('false'),
    FEATURE_SMS_ENABLED: booleanFromString('false'),
    FEATURE_PHILSYS_ENABLED: booleanFromString('false'),
    FEATURE_RECORDS_MANAGEMENT_ENABLED: booleanFromString('false'),
    FEATURE_EMAIL_NOTIFICATIONS_ENABLED: booleanFromString('true'),
    FEATURE_SSE_ENABLED: booleanFromString('true'),

    // ─── Disaster Recovery ────────────────────────────────────────────────
    DR_HOT_STANDBY_ENABLED: booleanFromString('false'),
    DR_HOT_STANDBY_URL: z.string().url().optional(),
    DR_MAX_REPLICATION_LAG_S: positiveInt.default(60),

    // ─── Backup ───────────────────────────────────────────────────────────
    BACKUP_ENABLED: booleanFromString('false'),
    BACKUP_ENCRYPTION_KEY: z.string().min(32).optional(),
    BACKUP_RETENTION_DAYS_HOT: positiveInt.default(30),
    BACKUP_RETENTION_DAYS_COLD: positiveInt.default(365),

    // ─── Portal (Phase 3 — fields declared now so the schema does not break later) ──
    PORTAL_URL: z.string().url().optional(),
    PORTAL_API_URL: z.string().url().optional(),
    PORTAL_CDN_URL: z.string().url().optional(),
    PORTAL_CITIZEN_OTP_EXPIRY_S: positiveInt.default(300),
    PORTAL_CITIZEN_OTP_LENGTH: positiveInt.default(6),
    PORTAL_CITIZEN_REVERIFY_DAYS: positiveInt.default(365),

    // ─── SMS (Phase 3) ────────────────────────────────────────────────────
    SMS_PROVIDER: z.string().optional(),
    SMS_API_KEY: z.string().optional(),
    SMS_SENDER_ID: z.string().max(11).default('BATAC'),
  })
  .superRefine((data, ctx) => {
    if (data.FEATURE_MEILISEARCH_ENABLED && !data.SEARCH_MEILISEARCH_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SEARCH_MEILISEARCH_URL'],
        message: 'SEARCH_MEILISEARCH_URL is required when FEATURE_MEILISEARCH_ENABLED is true',
      });
    }
    if (data.AUDIT_TSA_ENABLED && !data.AUDIT_TSA_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUDIT_TSA_URL'],
        message: 'AUDIT_TSA_URL is required when AUDIT_TSA_ENABLED is true',
      });
    }
    if (data.BACKUP_ENABLED && !data.BACKUP_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BACKUP_ENCRYPTION_KEY'],
        message: 'BACKUP_ENCRYPTION_KEY is required when BACKUP_ENABLED is true',
      });
    }
    if (data.DR_HOT_STANDBY_ENABLED && !data.DR_HOT_STANDBY_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DR_HOT_STANDBY_URL'],
        message: 'DR_HOT_STANDBY_URL is required when DR_HOT_STANDBY_ENABLED is true',
      });
    }
    if (data.AUTH_SESSION_WARNING_THRESHOLD_MS >= data.AUTH_SESSION_INACTIVITY_TIMEOUT_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_SESSION_WARNING_THRESHOLD_MS'],
        message:
          'AUTH_SESSION_WARNING_THRESHOLD_MS must be less than AUTH_SESSION_INACTIVITY_TIMEOUT_MS',
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;
