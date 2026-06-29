import { describe, expect, it } from 'vitest';
import {
  batchApplyInputSchema,
  createLessonInputSchema,
  createModuleInputSchema,
  listClassroomInputSchema,
  mapCommunityInputSchema,
  updateLessonInputSchema,
} from '../src/schemas.js';

describe('shared schemas', () => {
  it('accepts a valid classroom list input', () => {
    const input = listClassroomInputSchema.parse({
      communityUrl: 'https://www.skool.com/example/classroom',
    });

    expect(input.communityUrl).toBe('https://www.skool.com/example/classroom');
    expect(input.headless).toBe(true);
    expect(input.autoLogin).toBeUndefined();
  });

  it('defaults community map input to top-level scanning', () => {
    const input = mapCommunityInputSchema.parse({
      communityUrl: 'https://www.skool.com/example',
    });

    expect(input.communityUrl).toBe('https://www.skool.com/example');
    expect(input.deep).toBe(false);
  });

  it('accepts deep community map input from a tab URL', () => {
    const input = mapCommunityInputSchema.parse({
      communityUrl: 'https://www.skool.com/example/calendar',
      deep: true,
    });

    expect(input.communityUrl).toBe('https://www.skool.com/example/calendar');
    expect(input.deep).toBe(true);
  });

  it('defaults mutating inputs to dry-run mode', () => {
    const input = createModuleInputSchema.parse({
      communityUrl: 'https://www.skool.com/example/classroom',
      title: 'Start Here',
    });

    expect(input.execute).toBe(false);
  });

  it('validates lesson creation with body text and external video URL', () => {
    const input = createLessonInputSchema.parse({
      communityUrl: 'https://www.skool.com/example/classroom',
      moduleTitle: 'Week 1',
      title: 'Lesson 1',
      body: 'Watch this first.',
      videoUrl: 'https://video.example.com/watch/1',
      execute: true,
    });

    expect(input.moduleTitle).toBe('Week 1');
    expect(input.videoUrl).toBe('https://video.example.com/watch/1');
    expect(input.execute).toBe(true);
  });

  it('validates native upload file fields for lessons', () => {
    const input = createLessonInputSchema.parse({
      communityUrl: 'https://www.skool.com/example/classroom',
      moduleTitle: 'Week 1',
      title: 'Lesson 1',
      videoFile: '/tmp/lesson.mp4',
      imageFile: '/tmp/image.png',
    });

    expect(input.videoFile).toBe('/tmp/lesson.mp4');
    expect(input.imageFile).toBe('/tmp/image.png');
  });

  it('rejects ambiguous video URL and native video upload input', () => {
    const result = createLessonInputSchema.safeParse({
      communityUrl: 'https://www.skool.com/example/classroom',
      moduleTitle: 'Week 1',
      title: 'Lesson 1',
      videoUrl: 'https://video.example.com/watch/1',
      videoFile: '/tmp/lesson.mp4',
    });

    expect(result.success).toBe(false);
  });

  it('requires at least one editable field for lesson updates', () => {
    const result = updateLessonInputSchema.safeParse({
      communityUrl: 'https://www.skool.com/example/classroom',
      lessonTitle: 'Lesson 1',
    });

    expect(result.success).toBe(false);
  });

  it('validates a batch manifest with module and lesson operations', () => {
    const input = batchApplyInputSchema.parse({
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
          bodyFile: '/tmp/lesson.md',
          videoFile: '/tmp/video.mp4',
        },
        {
          type: 'lesson.edit',
          lessonTitle: 'Existing Lesson',
          body: 'Updated text',
        },
      ],
    });

    expect(input.execute).toBe(false);
    expect(input.operations).toHaveLength(3);
  });
});
