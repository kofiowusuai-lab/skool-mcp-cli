import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateUploadFile } from '../src/safety/files.js';

describe('validateUploadFile', () => {
  it('returns metadata for an existing upload file', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skool-upload-'));
    const filePath = path.join(dir, 'lesson.mp4');
    await fs.writeFile(filePath, 'video');

    const metadata = await validateUploadFile(filePath, ['.mp4', '.mov']);

    expect(metadata).toMatchObject({
      path: filePath,
      extension: '.mp4',
      sizeBytes: 5,
    });
  });

  it('rejects unsupported extensions', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skool-upload-'));
    const filePath = path.join(dir, 'lesson.txt');
    await fs.writeFile(filePath, 'nope');

    await expect(validateUploadFile(filePath, ['.mp4'])).rejects.toThrow('Unsupported upload file extension');
  });
});
