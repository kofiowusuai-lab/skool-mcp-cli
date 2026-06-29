import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildCliProgram, formatCommunityMapSummary, type CliHandlers } from '../src/cli.js';
import type { OperationResult } from '../src/skool/types.js';

function ok(operation: OperationResult['operation']): OperationResult {
  return {
    ok: true,
    dryRun: true,
    operation,
    message: 'ok',
  };
}

function communityMapResult(): OperationResult {
  return {
    ok: true,
    dryRun: true,
    operation: 'map_community',
    message: 'Mapped community.',
    data: {
      communityUrl: 'https://www.skool.com/example',
      scannedAt: '2026-06-26T00:00:00.000Z',
      depth: 'deep',
      tabs: [
        {
          key: 'community',
          label: 'Community',
          url: 'https://www.skool.com/example',
          accessible: true,
          summary: {
            visibleHeadings: ['Community'],
            visibleCounts: [],
            itemTitles: ['Welcome', 'Wins'],
          },
          warnings: [],
        },
        {
          key: 'calendar',
          label: 'Calendar',
          url: 'https://www.skool.com/example/calendar',
          accessible: true,
          summary: {
            visibleHeadings: ['Calendar'],
            visibleCounts: [],
            itemTitles: ['Monthly call'],
          },
          warnings: ['Calendar lazy-loaded after timeout.'],
        },
      ],
    },
  };
}

function cliHandlers(overrides: Partial<CliHandlers> = {}): CliHandlers {
  return {
    login: async () => ok('check_login'),
    list: async () => ok('list_classroom'),
    createModule: async () => ok('create_module'),
    createLesson: async () => ok('create_lesson'),
    updateLesson: async () => ok('update_lesson'),
    batchApply: async () => ok('batch_apply'),
    mapCommunity: async () => communityMapResult(),
    ...overrides,
  };
}

describe('buildCliProgram', () => {
  it('defaults module creation to dry-run mode', async () => {
    const calls: unknown[] = [];
    const handlers = cliHandlers({
      createModule: async (input) => {
        calls.push(input);
        return ok('create_module');
      },
    });

    const program = buildCliProgram(handlers, () => undefined);
    await program.parseAsync(
      ['node', 'skool', 'module', 'create', '--community', 'https://www.skool.com/example/classroom', '--title', 'Start Here'],
      { from: 'node' },
    );

    expect(calls).toEqual([
      {
        communityUrl: 'https://www.skool.com/example/classroom',
        title: 'Start Here',
        execute: false,
      },
    ]);
  });

  it('passes lesson creation body and execute flag to the handler', async () => {
    const calls: unknown[] = [];
    const handlers = cliHandlers({
      createLesson: async (input) => {
        calls.push(input);
        return ok('create_lesson');
      },
    });

    const program = buildCliProgram(handlers, () => undefined);
    await program.parseAsync(
      [
        'node',
        'skool',
        'lesson',
        'create',
        '--community',
        'https://www.skool.com/example/classroom',
        '--module',
        'Start Here',
        '--title',
        'Lesson 1',
        '--body',
        'Watch first.',
        '--video-url',
        'https://video.example.com/1',
        '--image-file',
        '/tmp/image.png',
        '--execute',
      ],
      { from: 'node' },
    );

    expect(calls).toEqual([
      {
        communityUrl: 'https://www.skool.com/example/classroom',
        moduleTitle: 'Start Here',
        title: 'Lesson 1',
        body: 'Watch first.',
        videoUrl: 'https://video.example.com/1',
        imageFile: '/tmp/image.png',
        execute: true,
      },
    ]);
  });

  it('passes headed mode when requested for browser debugging', async () => {
    const calls: unknown[] = [];
    const handlers = cliHandlers({
      login: async (input) => {
        calls.push(input);
        return ok('check_login');
      },
    });

    const program = buildCliProgram(handlers, () => undefined);
    await program.parseAsync(
      ['node', 'skool', '--headed', 'login', '--community', 'https://www.skool.com/example/classroom'],
      { from: 'node' },
    );

    expect(calls).toEqual([
      {
        communityUrl: 'https://www.skool.com/example/classroom',
        headless: false,
      },
    ]);
  });

  it('passes no-auto-login when fail-fast behavior is requested', async () => {
    const calls: unknown[] = [];
    const handlers = cliHandlers({
      list: async (input) => {
        calls.push(input);
        return ok('list_classroom');
      },
    });

    const program = buildCliProgram(handlers, () => undefined);
    await program.parseAsync(
      ['node', 'skool', '--no-auto-login', 'list', '--community', 'https://www.skool.com/example/classroom'],
      { from: 'node' },
    );

    expect(calls).toEqual([
      {
        communityUrl: 'https://www.skool.com/example/classroom',
        autoLogin: false,
      },
    ]);
  });

  it('applies a batch manifest from a JSON file', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skool-cli-batch-'));
    const manifestPath = path.join(dir, 'batch.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        communityUrl: 'https://www.skool.com/example/classroom',
        operations: [
          {
            type: 'module.create',
            title: 'New Module',
          },
        ],
      }),
    );

    const calls: unknown[] = [];
    const handlers = cliHandlers({
      batchApply: async (input) => {
        calls.push(input);
        return ok('batch_apply');
      },
    });

    const program = buildCliProgram(handlers, () => undefined);
    await program.parseAsync(['node', 'skool', 'batch', 'apply', '--file', manifestPath, '--execute'], { from: 'node' });

    expect(calls).toEqual([
      {
        communityUrl: 'https://www.skool.com/example/classroom',
        operations: [
          {
            type: 'module.create',
            title: 'New Module',
          },
        ],
        execute: true,
      },
    ]);
  });

  it('passes community map deep mode to the handler', async () => {
    const calls: unknown[] = [];
    const handlers = cliHandlers({
      mapCommunity: async (input) => {
        calls.push(input);
        return communityMapResult();
      },
    });

    const program = buildCliProgram(handlers, () => undefined);
    await program.parseAsync(
      ['node', 'skool', 'community', 'map', '--community', 'https://www.skool.com/example', '--deep'],
      { from: 'node' },
    );

    expect(calls).toEqual([
      {
        communityUrl: 'https://www.skool.com/example',
        deep: true,
      },
    ]);
  });

  it('prints JSON for community map when requested', async () => {
    const result = communityMapResult();
    let output = '';
    const handlers = cliHandlers({
      mapCommunity: async () => result,
    });

    const program = buildCliProgram(handlers, (value) => {
      output += value;
    });
    await program.parseAsync(
      ['node', 'skool', 'community', 'map', '--community', 'https://www.skool.com/example', '--json'],
      { from: 'node' },
    );

    expect(output).toBe(`${JSON.stringify(result, null, 2)}\n`);
  });

  it('prints a community map summary by default', async () => {
    const result = communityMapResult();
    let output = '';
    const handlers = cliHandlers({
      mapCommunity: async () => result,
    });

    const program = buildCliProgram(handlers, (value) => {
      output += value;
    });
    await program.parseAsync(['node', 'skool', 'community', 'map', '--community', 'https://www.skool.com/example'], {
      from: 'node',
    });

    expect(output).toBe(`${formatCommunityMapSummary(result)}\n`);
    expect(output).toContain('Skool community map: https://www.skool.com/example');
    expect(output).toContain('Depth: deep');
    expect(output).toContain('Tabs scanned: community, calendar');
    expect(output).toContain('Community: 2 visible items');
    expect(output).toContain('Calendar: 1 visible items');
    expect(output).toContain('Warnings: 1');
  });
});
