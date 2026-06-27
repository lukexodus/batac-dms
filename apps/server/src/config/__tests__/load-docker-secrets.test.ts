import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { loadDockerSecrets } from '../load-docker-secrets.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

describe('loadDockerSecrets', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should load secrets into process.env if they exist and are not already set', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      if (path === '/run/secrets/jwt_access_secret') return true;
      return false;
    });

    vi.mocked(readFileSync).mockImplementation((path) => {
      if (path === '/run/secrets/jwt_access_secret') return 'secret_from_file\n';
      throw new Error('File not found');
    });

    // Ensure it's not already set in process.env
    delete process.env['AUTH_JWT_ACCESS_SECRET'];

    loadDockerSecrets();

    expect(process.env['AUTH_JWT_ACCESS_SECRET']).toBe('secret_from_file');
  });

  it('should NOT overwrite a variable already present in process.env', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('new_secret');

    // Pre-set in process.env
    process.env['AUTH_JWT_ACCESS_SECRET'] = 'existing_secret';

    loadDockerSecrets();

    // Verify it was not overwritten
    expect(process.env['AUTH_JWT_ACCESS_SECRET']).toBe('existing_secret');
  });
});
