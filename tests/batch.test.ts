import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { batchApplyOperation } from '../src/core.js';

describe('batchApplyOperation', () => {
  it('dry-runs ordered batch operations and expands bodyFile content', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skool-batch-'));
    const bodyFile = path.join(dir, 'lesson.md');
    await fs.writeFile(bodyFile, 'Lesson body from file.');

    const result = await batchApplyOperation({
      communityUrl: 'https://www.skool.com/example/classroom',
      operations: [
        {
          type: 'module.create',
          title: 'New Module',
        },
        {
          type: 'lesson.create',
          moduleTitle: 'New Module',
          title: 'Lesson 1',
          bodyFile,
        },
        {
          type: 'lesson.edit',
          lessonTitle: 'Existing Lesson',
          body: 'Updated text',
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      dryRun: true,
      operation: 'batch_apply',
      message: 'Dry-run: planned 3 batch operations.',
    });
    expect(result.data).toMatchObject({
      results: [
        { operation: 'create_module', dryRun: true },
        { operation: 'create_lesson', dryRun: true },
        { operation: 'update_lesson', dryRun: true },
      ],
    });
  });
});
