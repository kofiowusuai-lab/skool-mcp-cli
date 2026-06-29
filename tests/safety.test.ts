import { describe, expect, it } from 'vitest';
import { makeArtifactPaths } from '../src/safety/artifacts.js';
import { SkoolAutomationError } from '../src/safety/errors.js';

describe('SkoolAutomationError', () => {
  it('serializes structured context for CLI and MCP callers', () => {
    const error = new SkoolAutomationError('selector_missing', 'Could not find save button.', {
      url: 'https://www.skool.com/example/classroom',
      screenshotPath: '/tmp/skool/save.png',
      tracePath: '/tmp/skool/save.zip',
      details: { selector: 'button:has-text("Save")' },
    });

    expect(error.toJSON()).toEqual({
      code: 'selector_missing',
      message: 'Could not find save button.',
      url: 'https://www.skool.com/example/classroom',
      screenshotPath: '/tmp/skool/save.png',
      tracePath: '/tmp/skool/save.zip',
      details: { selector: 'button:has-text("Save")' },
    });
  });
});

describe('makeArtifactPaths', () => {
  it('creates slugged screenshot and trace paths for an operation', () => {
    const paths = makeArtifactPaths('/tmp/skool-artifacts', 'Create Lesson: Week 1', new Date('2026-06-26T12:34:56Z'));

    expect(paths.screenshotPath).toBe('/tmp/skool-artifacts/2026-06-26T12-34-56-000Z-create-lesson-week-1.png');
    expect(paths.tracePath).toBe('/tmp/skool-artifacts/2026-06-26T12-34-56-000Z-create-lesson-week-1.zip');
  });
});
