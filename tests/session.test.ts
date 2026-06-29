import { describe, expect, it, vi } from 'vitest';
import { SkoolSession } from '../src/skool/session.js';

function pageStub(url: string, loginIndicatorCount: number) {
  return {
    url: () => url,
    getByText: vi.fn(() => ({
      count: vi.fn().mockResolvedValue(loginIndicatorCount),
    })),
  };
}

describe('SkoolSession login detection', () => {
  it('does not treat the login page as an authenticated Skool session', async () => {
    const session = new SkoolSession({
      profileDir: '.profiles/test',
      artifactDir: '.artifacts/test',
      headless: true,
    });

    await expect(session.isLoggedIn(pageStub('https://www.skool.com/login', 0) as never)).resolves.toBe(false);
  });

  it('treats a Skool page without login indicators as authenticated', async () => {
    const session = new SkoolSession({
      profileDir: '.profiles/test',
      artifactDir: '.artifacts/test',
      headless: true,
    });

    await expect(session.isLoggedIn(pageStub('https://www.skool.com/example/about', 0) as never)).resolves.toBe(true);
  });
});
