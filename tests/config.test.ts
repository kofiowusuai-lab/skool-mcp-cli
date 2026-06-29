import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config.js';

describe('resolveConfig', () => {
  it('uses headless local defaults when no env or flags are supplied', () => {
    const config = resolveConfig({}, {}, '/repo');

    expect(config.profileDir).toBe('/repo/.skool-profile');
    expect(config.artifactDir).toBe('/repo/artifacts');
    expect(config.headless).toBe(true);
    expect(config.autoLogin).toBe(true);
    expect(config.execute).toBe(false);
    expect(config.communityUrl).toBeUndefined();
  });

  it('lets CLI flags override environment values', () => {
    const config = resolveConfig(
      {
        SKOOL_PROFILE_DIR: '/env/profile',
        SKOOL_ARTIFACT_DIR: '/env/artifacts',
        SKOOL_COMMUNITY_URL: 'https://www.skool.com/env/classroom',
        SKOOL_HEADLESS: 'true',
        SKOOL_AUTO_LOGIN: 'true',
      },
      {
        profileDir: '/flag/profile',
        artifactDir: '/flag/artifacts',
        community: 'https://www.skool.com/flag/classroom',
        headless: false,
        autoLogin: false,
        execute: true,
      },
      '/repo',
    );

    expect(config.profileDir).toBe('/flag/profile');
    expect(config.artifactDir).toBe('/flag/artifacts');
    expect(config.communityUrl).toBe('https://www.skool.com/flag/classroom');
    expect(config.headless).toBe(false);
    expect(config.autoLogin).toBe(false);
    expect(config.execute).toBe(true);
  });
});
