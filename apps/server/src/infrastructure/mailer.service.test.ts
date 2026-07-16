import { describe, it, expect, vi, beforeEach } from 'vitest';
import nodemailer from 'nodemailer';
import { MailerService } from './mailer.service.js';
import { env } from '../config/env.js';

vi.mock('nodemailer', () => {
  const sendMailMock = vi.fn();
  const verifyMock = vi.fn();
  return {
    default: {
      createTransport: vi.fn(() => ({
        sendMail: sendMailMock,
        verify: verifyMock,
      })),
    },
  };
});

describe('MailerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws before calling sendMail when given a malformed recipient address', async () => {
    const service = new MailerService();
    const mockTransport = nodemailer.createTransport({});

    await expect(
      service.sendEmail({
        to: 'invalid-email',
        subject: 'Test',
      })
    ).rejects.toThrow(/Invalid recipient address/);

    expect(mockTransport.sendMail).not.toHaveBeenCalled();
  });

  it('throws before calling sendMail when given a malformed recipient address in an array', async () => {
    const service = new MailerService();
    const mockTransport = nodemailer.createTransport({});

    await expect(
      service.sendEmail({
        to: ['valid@example.com', 'invalid-email'],
        subject: 'Test',
      })
    ).rejects.toThrow(/Invalid recipient address/);

    expect(mockTransport.sendMail).not.toHaveBeenCalled();
  });

  it('calls transporter.sendMail with the correct from format and resolves result', async () => {
    const service = new MailerService();
    const mockTransport = nodemailer.createTransport({});
    vi.mocked(mockTransport.sendMail).mockResolvedValueOnce({
      messageId: 'test-msg-id',
      accepted: ['valid@example.com'],
      rejected: [],
    } as any);

    const result = await service.sendEmail({
      to: 'valid@example.com',
      subject: 'Test Subject',
      text: 'Test Body',
    });

    expect(mockTransport.sendMail).toHaveBeenCalledTimes(1);
    expect(mockTransport.sendMail).toHaveBeenCalledWith({
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM}>`,
      to: 'valid@example.com',
      subject: 'Test Subject',
      text: 'Test Body',
      html: undefined,
      replyTo: undefined,
    });

    expect(result).toEqual({
      messageId: 'test-msg-id',
      accepted: ['valid@example.com'],
      rejected: [],
    });
  });

  it('verifyConnection calls transporter.verify', async () => {
    const service = new MailerService();
    const mockTransport = nodemailer.createTransport({});
    vi.mocked(mockTransport.verify).mockResolvedValueOnce(true);

    const result = await service.verifyConnection();

    expect(mockTransport.verify).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });
});
