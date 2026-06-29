import path from 'node:path';

export type ConfigFlags = {
  profileDir?: string;
  artifactDir?: string;
  community?: string;
  headless?: boolean;
  autoLogin?: boolean;
  execute?: boolean;
};

export type SkoolConfig = {
  profileDir: string;
  artifactDir: string;
  communityUrl?: string;
  headless: boolean;
  autoLogin: boolean;
  execute: boolean;
};

function resolveBoolean(value: string | boolean | undefined, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === undefined || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function resolvePath(cwd: string, value: string | undefined, fallbackName: string): string {
  const rawPath = value ?? path.join(cwd, fallbackName);
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(cwd, rawPath);
}

export function resolveConfig(
  env: NodeJS.ProcessEnv = process.env,
  flags: ConfigFlags = {},
  cwd = process.cwd(),
): SkoolConfig {
  return {
    profileDir: resolvePath(cwd, flags.profileDir ?? env.SKOOL_PROFILE_DIR, '.skool-profile'),
    artifactDir: resolvePath(cwd, flags.artifactDir ?? env.SKOOL_ARTIFACT_DIR, 'artifacts'),
    communityUrl: flags.community ?? env.SKOOL_COMMUNITY_URL,
    headless: resolveBoolean(flags.headless ?? env.SKOOL_HEADLESS, true),
    autoLogin: resolveBoolean(flags.autoLogin ?? env.SKOOL_AUTO_LOGIN, true),
    execute: resolveBoolean(flags.execute ?? env.SKOOL_EXECUTE, false),
  };
}
