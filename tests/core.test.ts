import { describe, expect, it } from 'vitest';
import { createLessonOperation, createModuleOperation, updateLessonOperation } from '../src/core.js';

describe('core dry-run operations', () => {
  it('plans module creation without launching a browser', async () => {
    const result = await createModuleOperation({
      communityUrl: 'https://www.skool.com/example/classroom',
      title: 'Start Here',
    });

    expect(result).toMatchObject({
      ok: true,
      dryRun: true,
      operation: 'create_module',
      message: 'Dry-run: would create module "Start Here".',
    });
  });

  it('plans lesson creation with an external video URL', async () => {
    const result = await createLessonOperation({
      communityUrl: 'https://www.skool.com/example/classroom',
      moduleTitle: 'Start Here',
      title: 'Lesson 1',
      body: 'Watch this first.',
      videoUrl: 'https://video.example.com/1',
    });

    expect(result).toMatchObject({
      ok: true,
      dryRun: true,
      operation: 'create_lesson',
      target: {
        moduleTitle: 'Start Here',
        lessonTitle: 'Lesson 1',
      },
    });
  });

  it('plans lesson updates and lists only supplied fields', async () => {
    const result = await updateLessonOperation({
      communityUrl: 'https://www.skool.com/example/classroom',
      lessonTitle: 'Lesson 1',
      videoUrl: 'https://video.example.com/2',
    });

    expect(result).toMatchObject({
      ok: true,
      dryRun: true,
      operation: 'update_lesson',
      changedFields: ['videoUrl'],
    });
  });
});
