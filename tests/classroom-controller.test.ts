import { describe, expect, it } from 'vitest';
import { normalizeCourseCardRecords } from '../src/skool/classroom-controller.js';

describe('normalizeCourseCardRecords', () => {
  it('extracts Skool course cards from DOM child records', () => {
    const modules = normalizeCourseCardRecords([
      {
        title: 'Welcome & The Opportunity',
        description: "Start here. See exactly what you'll build.",
        progress: '0%',
      },
      {
        title: 'Your AI Stack (Setup)',
        description: 'Set up your full toolkit.',
        progress: '0%',
      },
      {
        title: '',
        description: '',
        progress: '',
      },
    ]);

    expect(modules).toEqual([
      {
        title: 'Welcome & The Opportunity',
        description: "Start here. See exactly what you'll build.",
        progress: '0%',
        lessons: [],
      },
      {
        title: 'Your AI Stack (Setup)',
        description: 'Set up your full toolkit.',
        progress: '0%',
        lessons: [],
      },
    ]);
  });
});
