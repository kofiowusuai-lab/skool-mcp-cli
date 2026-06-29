import path from 'node:path';

export type ArtifactPaths = {
  screenshotPath: string;
  tracePath: string;
};

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'skool-action';
}

function timestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function makeArtifactPaths(artifactDir: string, operationName: string, date = new Date()): ArtifactPaths {
  const prefix = `${timestamp(date)}-${slugify(operationName)}`;

  return {
    screenshotPath: path.join(artifactDir, `${prefix}.png`),
    tracePath: path.join(artifactDir, `${prefix}.zip`),
  };
}
