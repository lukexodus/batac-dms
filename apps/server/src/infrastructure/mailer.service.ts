import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { z } from 'zod';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

const emailSchema = z.string().email();
const recipientSchema = z.union([
  emailSchema,
  z.array(emailSchema).min(1),
]);

export class MailerService {
  private readonly transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      tls: { rejectUnauthorized: env.SMTP_REJECT_UNAUTHORIZED },
      pool: env.SMTP_POOL,
      maxConnections: env.SMTP_MAX_CONNECTIONS,
      maxMessages: env.SMTP_MAX_MESSAGES,
      debug: env.SMTP_DEBUG,
      logger: env.SMTP_DEBUG,
    } as any);
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const parseResult = recipientSchema.safeParse(input.to);
    if (!parseResult.success) {
      throw new Error(`Invalid recipient address: ${parseResult.error.message}`);
    }

    const info = await this.transporter.sendMail({
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
    });

    return {
      messageId: info.messageId,
      accepted: info.accepted as string[],
      rejected: info.rejected as string[],
    };
  }

  async verifyConnection(): Promise<boolean> {
    return this.transporter.verify();
  }
}
