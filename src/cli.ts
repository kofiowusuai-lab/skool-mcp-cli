#!/usr/bin/env node
import fs from 'node:fs/promises';
import { Command } from 'commander';
import {
  batchApplyOperation,
  createLessonOperation,
  createModuleOperation,
  listClassroomOperation,
  loginOperation,
  mapCommunityOperation,
  updateLessonOperation,
} from './core.js';
import { serializeError } from './safety/errors.js';
import type {
  BatchApplyInput,
  CreateLessonInput,
  CreateModuleInput,
  ListClassroomInput,
  LoginInput,
  MapCommunityInput,
  UpdateLessonInput,
} from './schemas.js';
import type { OperationResult } from './skool/types.js';

export type CliHandlers = {
  login: (input: LoginInput) => Promise<OperationResult>;
  list: (input: ListClassroomInput) => Promise<OperationResult>;
  createModule: (input: CreateModuleInput) => Promise<OperationResult>;
  createLesson: (input: CreateLessonInput) => Promise<OperationResult>;
  updateLesson: (input: UpdateLessonInput) => Promise<OperationResult>;
  batchApply: (input: BatchApplyInput) => Promise<OperationResult>;
  mapCommunity: (input: MapCommunityInput) => Promise<OperationResult>;
};

type OutputWriter = (value: string) => void;

type GlobalOptions = {
  profileDir?: string;
  artifactDir?: string;
  headless?: boolean;
  headed?: boolean;
  autoLogin?: boolean;
};

type BodyOptions = {
  body?: string;
  bodyFile?: string;
};

type CommunityMapTabSummary = {
  itemTitles?: unknown[];
};

type CommunityMapTab = {
  key?: unknown;
  label?: unknown;
  summary?: CommunityMapTabSummary;
  warnings?: unknown[];
  details?: Array<{ warnings?: unknown[] }>;
};

type CommunityMapManifest = {
  communityUrl?: unknown;
  depth?: unknown;
  tabs?: CommunityMapTab[];
};

export const defaultHandlers: CliHandlers = {
  login: loginOperation,
  list: listClassroomOperation,
  createModule: createModuleOperation,
  createLesson: createLessonOperation,
  updateLesson: updateLessonOperation,
  batchApply: batchApplyOperation,
  mapCommunity: mapCommunityOperation,
};

function writeResult(writeOutput: OutputWriter, result: OperationResult): void {
  writeOutput(`${JSON.stringify(result, null, 2)}\n`);
}

function isCommunityMapManifest(value: unknown): value is CommunityMapManifest {
  return typeof value === 'object' && value !== null && Array.isArray((value as CommunityMapManifest).tabs);
}

function warningCount(result: OperationResult, manifest: CommunityMapManifest): number {
  const tabWarnings = manifest.tabs?.reduce((total, tab) => {
    const directWarnings = Array.isArray(tab.warnings) ? tab.warnings.length : 0;
    const detailWarnings = Array.isArray(tab.details)
      ? tab.details.reduce((detailTotal, detail) => detailTotal + (Array.isArray(detail.warnings) ? detail.warnings.length : 0), 0)
      : 0;

    return total + directWarnings + detailWarnings;
  }, 0) ?? 0;

  return tabWarnings || (Array.isArray(result.warnings) ? result.warnings.length : 0);
}

export function formatCommunityMapSummary(result: OperationResult): string {
  if (!isCommunityMapManifest(result.data)) {
    return [
      'Skool community map: unknown',
      'Depth: unknown',
      'Tabs scanned: ',
      'Warnings: 0',
    ].join('\n');
  }

  const manifest = result.data;
  const tabs = manifest.tabs ?? [];
  const lines = [
    `Skool community map: ${typeof manifest.communityUrl === 'string' ? manifest.communityUrl : 'unknown'}`,
    `Depth: ${typeof manifest.depth === 'string' ? manifest.depth : 'unknown'}`,
    `Tabs scanned: ${tabs.map((tab) => (typeof tab.key === 'string' ? tab.key : 'unknown')).join(', ')}`,
  ];

  for (const tab of tabs) {
    const label = typeof tab.label === 'string' ? tab.label : 'Unknown';
    const itemCount = Array.isArray(tab.summary?.itemTitles) ? tab.summary.itemTitles.length : 0;
    lines.push(`${label}: ${itemCount} visible items`);
  }

  lines.push(`Warnings: ${warningCount(result, manifest)}`);

  return lines.join('\n');
}

async function resolveBody(options: BodyOptions): Promise<string | undefined> {
  if (options.body !== undefined && options.bodyFile !== undefined) {
    throw new Error('Use either --body or --body-file, not both.');
  }

  if (options.bodyFile) {
    return fs.readFile(options.bodyFile, 'utf8');
  }

  return options.body;
}

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function globalOptions(command: Command): GlobalOptions {
  const root = command.optsWithGlobals<GlobalOptions>();
  const options: GlobalOptions = {};

  if (root.profileDir) {
    options.profileDir = root.profileDir;
  }

  if (root.artifactDir) {
    options.artifactDir = root.artifactDir;
  }

  if (root.headed) {
    options.headless = false;
  } else if (root.headless) {
    options.headless = true;
  }

  if (root.autoLogin === false) {
    options.autoLogin = false;
  }

  return options;
}

export function buildCliProgram(handlers: CliHandlers = defaultHandlers, writeOutput: OutputWriter = process.stdout.write.bind(process.stdout)): Command {
  const program = new Command();

  program
    .name('skool')
    .description('Local CLI for Skool Classroom automation through a dedicated Playwright profile.')
    .option('--profile-dir <path>', 'Persistent Playwright profile directory')
    .option('--artifact-dir <path>', 'Directory for screenshots and traces')
    .option('--headless', 'Run Playwright headless; retained for compatibility because this is now the default', false)
    .option('--headed', 'Run Playwright with a visible browser for login or debugging', false)
    .option('--auto-login', 'Automatically open a headed browser when login is required', true)
    .option('--no-auto-login', 'Fail fast instead of opening a headed browser when login is required');

  program
    .command('login')
    .requiredOption('--community <url>', 'Skool community or classroom URL')
    .action(async (options: { community: string }, command) => {
      const result = await handlers.login({
        communityUrl: options.community,
        ...globalOptions(command),
      });
      writeResult(writeOutput, result);
    });

  program
    .command('list')
    .requiredOption('--community <url>', 'Skool community or classroom URL')
    .action(async (options: { community: string }, command) => {
      const result = await handlers.list({
        communityUrl: options.community,
        ...globalOptions(command),
      });
      writeResult(writeOutput, result);
    });

  const communityCommand = program.command('community').description('Inspect Skool community areas.');
  communityCommand
    .command('map')
    .requiredOption('--community <url>', 'Skool community URL')
    .option('--deep', 'Scan bounded one-level detail pages', false)
    .option('--json', 'Print the full JSON operation result', false)
    .action(async (options: { community: string; deep: boolean; json: boolean }, command) => {
      const result = await handlers.mapCommunity({
        communityUrl: options.community,
        deep: options.deep,
        ...globalOptions(command),
      });

      if (options.json) {
        writeResult(writeOutput, result);
        return;
      }

      writeOutput(`${formatCommunityMapSummary(result)}\n`);
    });

  const moduleCommand = program.command('module').description('Manage Skool modules.');
  moduleCommand
    .command('create')
    .requiredOption('--community <url>', 'Skool community or classroom URL')
    .requiredOption('--title <title>', 'Module title')
    .option('--cover-image-file <path>', 'Local image file to upload as the native Skool module/course cover')
    .option('--execute', 'Apply the change to Skool', false)
    .action(async (options: { community: string; title: string; coverImageFile?: string; execute: boolean }, command) => {
      const result = await handlers.createModule({
        communityUrl: options.community,
        title: options.title,
        coverImageFile: options.coverImageFile,
        execute: options.execute,
        ...globalOptions(command),
      });
      writeResult(writeOutput, result);
    });

  const lessonCommand = program.command('lesson').description('Manage Skool lessons.');
  lessonCommand
    .command('create')
    .requiredOption('--community <url>', 'Skool community or classroom URL')
    .requiredOption('--module <title>', 'Target module title')
    .requiredOption('--title <title>', 'Lesson title')
    .option('--body <text>', 'Lesson body text')
    .option('--body-file <path>', 'Path to a markdown/plain-text body file')
    .option('--video-url <url>', 'External video URL')
    .option('--video-file <path>', 'Local video file to upload through Skool native upload')
    .option('--image-file <path>', 'Local image file to upload through Skool native upload')
    .option('--execute', 'Apply the change to Skool', false)
    .action(async (options: { community: string; module: string; title: string; body?: string; bodyFile?: string; videoUrl?: string; videoFile?: string; imageFile?: string; execute: boolean }, command) => {
      const result = await handlers.createLesson({
        communityUrl: options.community,
        moduleTitle: options.module,
        title: options.title,
        body: await resolveBody(options),
        videoUrl: options.videoUrl,
        videoFile: options.videoFile,
        imageFile: options.imageFile,
        execute: options.execute,
        ...globalOptions(command),
      });
      writeResult(writeOutput, result);
    });

  lessonCommand
    .command('edit')
    .requiredOption('--community <url>', 'Skool community or classroom URL')
    .option('--module <title>', 'Module that holds the lesson; opened first so the lesson title is on the page')
    .option('--lesson <title>', 'Current lesson title (exact match). Use --lesson-url for unambiguous targeting')
    .option('--lesson-url <url>', 'Direct lesson URL (…/classroom/<course>?md=<unit_id>); selects the exact lesson')
    .option('--title <title>', 'New lesson title')
    .option('--body <text>', 'Lesson body text')
    .option('--body-file <path>', 'Path to a markdown/plain-text body file')
    .option('--video-url <url>', 'External video URL')
    .option('--video-file <path>', 'Local video file to upload through Skool native upload')
    .option('--image-file <path>', 'Local image file to upload through Skool native upload')
    .option('--execute', 'Apply the change to Skool', false)
    .action(async (options: { community: string; module?: string; lesson?: string; lessonUrl?: string; title?: string; body?: string; bodyFile?: string; videoUrl?: string; videoFile?: string; imageFile?: string; execute: boolean }, command) => {
      const result = await handlers.updateLesson({
        communityUrl: options.community,
        moduleTitle: options.module,
        lessonTitle: options.lesson,
        lessonUrl: options.lessonUrl,
        title: options.title,
        body: await resolveBody(options),
        videoUrl: options.videoUrl,
        videoFile: options.videoFile,
        imageFile: options.imageFile,
        execute: options.execute,
        ...globalOptions(command),
      });
      writeResult(writeOutput, result);
    });

  const batchCommand = program.command('batch').description('Apply multiple Skool module and lesson operations from a manifest.');
  batchCommand
    .command('apply')
    .requiredOption('--file <path>', 'Path to a JSON batch manifest')
    .option('--execute', 'Apply the manifest to Skool in order', false)
    .action(async (options: { file: string; execute: boolean }, command) => {
      const manifest = await readJsonFile(options.file);
      if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
        throw new Error('Batch manifest must be a JSON object.');
      }

      const result = await handlers.batchApply({
        ...manifest,
        execute: options.execute,
        ...globalOptions(command),
      } as BatchApplyInput);
      writeResult(writeOutput, result);
    });

  return program;
}

async function main(): Promise<void> {
  try {
    await buildCliProgram().parseAsync(process.argv);
  } catch (error) {
    process.stderr.write(`${JSON.stringify(serializeError(error), null, 2)}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
