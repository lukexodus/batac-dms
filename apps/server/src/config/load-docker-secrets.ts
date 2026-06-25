import { readFileSync, existsSync } from 'fs';

const SECRET_MAPPING: Record<string, string> = {
  '/run/secrets/jwt_access_secret': 'AUTH_JWT_ACCESS_SECRET',
  '/run/secrets/jwt_refresh_secret': 'AUTH_JWT_REFRESH_SECRET',
  '/run/secrets/audit_hmac_secret': 'AUDIT_HMAC_SECRET',
  '/run/secrets/database_url_app': 'DATABASE_URL_APP',
  '/run/secrets/database_url_audit': 'DATABASE_URL_AUDIT',
  '/run/secrets/s3_access_key': 'S3_ACCESS_KEY',
  '/run/secrets/s3_secret_key': 'S3_SECRET_KEY',
  '/run/secrets/smtp_password': 'SMTP_PASSWORD',
  '/run/secrets/backup_encryption_key': 'BACKUP_ENCRYPTION_KEY',
};

export function loadDockerSecrets(): void {
  for (const [path, envVar] of Object.entries(SECRET_MAPPING)) {
    if (existsSync(path) && !process.env[envVar]) {
      process.env[envVar] = readFileSync(path, 'utf8').trim();
    }
  }
}
