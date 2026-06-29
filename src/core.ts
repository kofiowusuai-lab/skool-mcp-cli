import fs from 'node:fs/promises';
import { resolveConfig, type ConfigFlags } from './config.js';
import {
  batchApplyInputSchema,
  createLessonInputSchema,
  createModuleInputSchema,
  listClassroomInputSchema,
  loginInputSchema,
  mapCommunityInputSchema,
  reorderLessonsInputSchema,
  updateLessonInputSchema,
  type BatchApplyInput,
  type BatchOperationInput,
  type CreateLessonInput,
  type CreateModuleInput,
  type ListClassroomInput,
  type LoginInput,
  type MapCommunityInput,
  type ReorderLessonsInput,
  type UpdateLessonInput,
} from './schemas.js';
import { ClassroomController } from './skool/classroom-controller.js';
import { CommunityController } from './skool/community-controller.js';
import { SkoolSession } from './skool/session.js';
import type { OperationResult } from './skool/types.js';

type OperationOptions = ConfigFlags & {
  cwd?: string;
};

type ControllerContext = {
  controller: ClassroomController;
  session: SkoolSession;
};

type CommunityControllerContext = {
  controller: CommunityController;
  session: SkoolSession;
};

type LifecycleInput = {
  communityUrl: string;
  profileDir?: string;
  artifactDir?: string;
  headless?: boolean;
  autoLogin?: boolean;
  execute?: boolean;
};

function resolvedConfigFor(input: LifecycleInput, options: OperationOptions = {}) {
  const config = resolveConfig(process.env, options, options.cwd);
  return {
    profileDir: input.profileDir ?? config.profileDir,
    artifactDir: input.artifactDir ?? config.artifactDir,
    headless: input.headless ?? config.headless,
    autoLogin: input.autoLogin ?? config.autoLogin,
  };
}

function controllerFor(input: LifecycleInput, options: OperationOptions = {}, headlessOverride?: boolean): ControllerContext {
  const config = resolvedConfigFor(input, options);
  const session = new SkoolSession({
    profileDir: config.profileDir,
    artifactDir: config.artifactDir,
    headless: headlessOverride ?? config.headless,
  });

  return {
    controller: new ClassroomController(session),
    session,
  };
}

function communityControllerFor(
  input: LifecycleInput,
  options: OperationOptions = {},
  headlessOverride?: boolean,
): CommunityControllerContext {
  const config = resolvedConfigFor(input, options);
  const session = new SkoolSession({
    profileDir: config.profileDir,
    artifactDir: config.artifactDir,
    headless: headlessOverride ?? config.headless,
  });

  return {
    controller: new CommunityController(session),
    session,
  };
}

async function withController(
  input: LifecycleInput,
  options: OperationOptions,
  run: (controller: ClassroomController) => Promise<OperationResult>,
): Promise<OperationResult> {
  const config = resolvedConfigFor(input, options);
  const isDryRunMutation = 'execute' in input && input.execute === false;

  if (config.autoLogin && !isDryRunMutation) {
    await ensureLoggedIn(input, options, config.headless);
  }

  const { controller, session } = controllerFor(input, options);

  try {
    return await run(controller);
  } finally {
    await session.close();
  }
}

async function withCommunityController(
  input: LifecycleInput,
  options: OperationOptions,
  run: (controller: CommunityController) => Promise<OperationResult>,
): Promise<OperationResult> {
  const config = resolvedConfigFor(input, options);

  await ensureLoggedInForReadOnly(input, options, config.headless, config.autoLogin);

  const { controller, session } = communityControllerFor(input, options);

  try {
    return await run(controller);
  } finally {
    await session.close();
  }
}

async function ensureLoggedIn(input: LifecycleInput, options: OperationOptions, preferredHeadless: boolean): Promise<void> {
  const first = controllerFor(input, options, preferredHeadless);

  try {
    const result = await first.controller.checkLogin(input);
    if (result.ok) {
      return;
    }
  } finally {
    await first.session.close();
  }

  const headed = controllerFor(input, options, false);

  try {
    await waitForHeadedLogin(headed.controller, input);
  } finally {
    await headed.session.close();
  }
}

async function ensureLoggedInForReadOnly(
  input: LifecycleInput,
  options: OperationOptions,
  preferredHeadless: boolean,
  autoLogin: boolean,
): Promise<void> {
  const first = controllerFor(input, options, preferredHeadless);

  try {
    const result = await first.controller.checkLogin(input);
    if (result.ok) {
      return;
    }

    if (!autoLogin) {
      throw new Error(result.message || 'Skool login is required in the Playwright profile.');
    }
  } finally {
    await first.session.close();
  }

  const headed = controllerFor(input, options, false);

  try {
    await waitForHeadedLogin(headed.controller, input);
  } finally {
    await headed.session.close();
  }
}

async function waitForHeadedLogin(controller: ClassroomController, input: LifecycleInput): Promise<void> {
  const deadline = Date.now() + 5 * 60 * 1000;

  while (Date.now() < deadline) {
    const result = await controller.checkLogin(input);
    if (result.ok) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error('Skool login was not completed within 5 minutes.');
}

export async function loginOperation(rawInput: LoginInput, options: OperationOptions = {}): Promise<OperationResult> {
  const input = loginInputSchema.parse(rawInput);
  return withController(input, options, (controller) => controller.checkLogin(input));
}

export async function listClassroomOperation(rawInput: ListClassroomInput, options: OperationOptions = {}): Promise<OperationResult> {
  const input = listClassroomInputSchema.parse(rawInput);
  return withController(input, options, (controller) => controller.listClassroom(input));
}

export async function mapCommunityOperation(rawInput: MapCommunityInput, options: OperationOptions = {}): Promise<OperationResult> {
  const input = mapCommunityInputSchema.parse(rawInput);
  return withCommunityController(input, options, (controller) => controller.mapCommunity(input));
}

export async function createModuleOperation(rawInput: CreateModuleInput, options: OperationOptions = {}): Promise<OperationResult> {
  const input = createModuleInputSchema.parse(rawInput);
  return withController(input, options, (controller) => controller.createModule(input));
}

export async function createLessonOperation(rawInput: CreateLessonInput, options: OperationOptions = {}): Promise<OperationResult> {
  const input = createLessonInputSchema.parse(rawInput);
  return withController(input, options, (controller) => controller.createLesson(input));
}

export async function updateLessonOperation(rawInput: UpdateLessonInput, options: OperationOptions = {}): Promise<OperationResult> {
  const input = updateLessonInputSchema.parse(rawInput);
  return withController(input, options, (controller) => controller.updateLesson(input));
}

export async function reorderLessonsOperation(rawInput: ReorderLessonsInput, options: OperationOptions = {}): Promise<OperationResult> {
  const input = reorderLessonsInputSchema.parse(rawInput);
  return withController(input, options, (controller) => controller.reorderLessons(input));
}

export async function batchApplyOperation(rawInput: BatchApplyInput, options: OperationOptions = {}): Promise<OperationResult> {
  const input = batchApplyInputSchema.parse(rawInput);
  const results: OperationResult[] = [];

  for (let index = 0; index < input.operations.length; index += 1) {
    const operation = input.operations[index] as BatchOperationInput;
    const result = await runBatchOperation(input, operation, options);
    results.push({
      ...result,
      data: {
        ...(typeof result.data === 'object' && result.data !== null ? result.data : {}),
        batchIndex: index,
        batchType: operation.type,
      },
    });

    if (!result.ok) {
      return {
        ok: false,
        dryRun: !input.execute,
        operation: 'batch_apply',
        message: `Batch stopped after operation ${index + 1} failed.`,
        data: { results },
      };
    }
  }

  return {
    ok: true,
    dryRun: !input.execute,
    operation: 'batch_apply',
    message: input.execute ? `Executed ${results.length} batch operations.` : `Dry-run: planned ${results.length} batch operations.`,
    data: { results },
  };
}

async function runBatchOperation(
  batch: ReturnType<typeof batchApplyInputSchema.parse>,
  operation: BatchOperationInput,
  options: OperationOptions,
): Promise<OperationResult> {
  const base = {
    communityUrl: batch.communityUrl,
    profileDir: batch.profileDir,
    artifactDir: batch.artifactDir,
    headless: batch.headless,
    autoLogin: batch.autoLogin,
    execute: batch.execute,
  };

  if (operation.type === 'module.create') {
    return createModuleOperation(
      {
        ...base,
        title: operation.title,
        coverImageFile: operation.coverImageFile,
      },
      options,
    );
  }

  if (operation.type === 'lesson.create') {
    return createLessonOperation(
      {
        ...base,
        moduleTitle: operation.moduleTitle,
        title: operation.title,
        body: await resolveBatchBody(operation),
        videoUrl: operation.videoUrl,
        videoFile: operation.videoFile,
        imageFile: operation.imageFile,
      },
      options,
    );
  }

  return updateLessonOperation(
    {
      ...base,
      lessonTitle: operation.lessonTitle,
      title: operation.title,
      body: await resolveBatchBody(operation),
      videoUrl: operation.videoUrl,
      videoFile: operation.videoFile,
      imageFile: operation.imageFile,
    },
    options,
  );
}

async function resolveBatchBody(operation: BatchOperationInput): Promise<string | undefined> {
  if (!('bodyFile' in operation) || operation.bodyFile === undefined) {
    return 'body' in operation ? operation.body : undefined;
  }

  return fs.readFile(operation.bodyFile, 'utf8');
}
