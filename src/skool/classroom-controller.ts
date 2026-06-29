import type { Page } from 'playwright';
import type { CreateLessonInput, CreateModuleInput, ListClassroomInput, ReorderLessonsInput, UpdateLessonInput } from '../schemas.js';
import { SkoolAutomationError } from '../safety/errors.js';
import { IMAGE_EXTENSIONS, validateUploadFile, VIDEO_EXTENSIONS, type UploadFileMetadata } from '../safety/files.js';
import type { ClassroomSnapshot, OperationResult } from './types.js';
import { SkoolSession } from './session.js';
import { uploadNativeFile } from './upload-controller.js';
import { markdownToTiptapHtml } from './markdown.js';

const SELECT_ALL = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';

export type CourseCardRecord = {
  title: string;
  description?: string;
  progress?: string;
};

export function normalizeCourseCardRecords(records: CourseCardRecord[]): ClassroomSnapshot['modules'] {
  return records
    .map((record) => ({
      title: record.title.trim(),
      description: record.description?.trim(),
      progress: record.progress?.trim(),
      lessons: [],
    }))
    .filter((module) => module.title.length > 0);
}

async function clickFirst(page: Page, labels: RegExp, errorCode: string): Promise<void> {
  const button = page.getByRole('button', { name: labels }).first();
  if ((await button.count()) === 0) {
    throw new SkoolAutomationError(errorCode, `Could not find button matching ${labels}.`, {
      url: page.url(),
      details: { labels: String(labels) },
    });
  }

  await button.click();
}

async function fillFirst(page: Page, labels: RegExp, value: string, errorCode: string): Promise<void> {
  const control = page.getByLabel(labels).first();
  if ((await control.count()) > 0) {
    await control.fill(value);
    return;
  }

  const textbox = page.getByRole('textbox', { name: labels }).first();
  if ((await textbox.count()) > 0) {
    await textbox.fill(value);
    return;
  }

  throw new SkoolAutomationError(errorCode, `Could not find input matching ${labels}.`, {
    url: page.url(),
    details: { labels: String(labels) },
  });
}

async function lessonEditorVisible(page: Page): Promise<boolean> {
  try {
    await page.locator('input[placeholder="Title"]').first().waitFor({ state: 'visible', timeout: 4000 });
    return true;
  } catch {
    return false;
  }
}

// Open Skool's inline lesson editor. The edit control is an unlabelled icon
// button beside the lesson completion check, so we try the stable sibling
// relationship first, then a labelled control, then header-icon geometry.
async function openLessonEditor(page: Page): Promise<void> {
  if (await lessonEditorVisible(page)) {
    return;
  }

  const sibling = page.locator('[class*="ModuleCompletion"]').locator('xpath=following-sibling::button[1]');
  if ((await sibling.count()) > 0) {
    await sibling.first().click().catch(() => undefined);
    if (await lessonEditorVisible(page)) {
      return;
    }
  }

  const labelled = page.getByRole('button', { name: /edit/i }).first();
  if ((await labelled.count()) > 0) {
    await labelled.click().catch(() => undefined);
    if (await lessonEditorVisible(page)) {
      return;
    }
  }

  const candidateIndexes: number[] = await page.evaluate(() => {
    const picks: number[] = [];
    const buttons = Array.from(document.querySelectorAll('button'));
    buttons.forEach((button, index) => {
      const rect = button.getBoundingClientRect();
      const text = (button.textContent || '').trim();
      const isCompletion = /ModuleCompletion/.test(button.className || '');
      if (
        text.length === 0 &&
        !isCompletion &&
        rect.width > 0 &&
        rect.width < 64 &&
        rect.top > 110 &&
        rect.top < 320 &&
        rect.right > window.innerWidth * 0.6
      ) {
        picks.push(index);
      }
    });
    return picks;
  });

  const buttons = page.locator('button');
  for (const index of candidateIndexes.reverse()) {
    await buttons.nth(index).click().catch(() => undefined);
    if (await lessonEditorVisible(page)) {
      return;
    }
  }

  throw new SkoolAutomationError('lesson_edit_button_missing', 'Could not open the lesson editor.', {
    url: page.url(),
  });
}

async function setLessonTitle(page: Page, title: string): Promise<void> {
  const input = page.locator('input[placeholder="Title"]').first();
  await input.click();
  await input.fill(title);
}

// Skool's body editor is a tiptap/ProseMirror contenteditable. Typing Markdown
// triggers inconsistent input rules, so we clear the document and paste an HTML
// fragment, which tiptap maps cleanly onto its schema.
async function setLessonBody(page: Page, html: string): Promise<void> {
  const editor = page.locator('.ProseMirror').first();
  await editor.click();
  await page.keyboard.press(SELECT_ALL);
  await page.keyboard.press('Delete');
  await editor.evaluate((element, fragment) => {
    (element as HTMLElement).focus();
    const transfer = new DataTransfer();
    transfer.setData('text/html', fragment);
    transfer.setData('text/plain', element.textContent || '');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
  }, html);
  await page.waitForTimeout(300);
}

// Click Save, tolerating Skool's disabled-Save state when the form has no
// pending diff (idempotent re-runs). Returns true when a save was committed.
async function saveLessonEditor(page: Page): Promise<boolean> {
  const save = page.getByRole('button', { name: /^save$/i }).first();
  if ((await save.count()) === 0) {
    throw new SkoolAutomationError('lesson_save_button_missing', 'Could not find the Save button.', {
      url: page.url(),
    });
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await save.isEnabled()) {
      break;
    }
    await page.waitForTimeout(200);
  }

  if (!(await save.isEnabled())) {
    await page.getByRole('button', { name: /^cancel$/i }).first().click().catch(() => undefined);
    return false;
  }

  await save.click();
  await page
    .locator('input[placeholder="Title"]')
    .first()
    .waitFor({ state: 'detached', timeout: 15_000 })
    .catch(() => undefined);
  return true;
}

function changedLessonFields(input: UpdateLessonInput): string[] {
  return (['title', 'body', 'videoUrl', 'videoFile', 'imageFile'] as const).filter((field) => input[field] !== undefined);
}

async function collectUploadMetadata(input: {
  videoFile?: string;
  imageFile?: string;
  coverImageFile?: string;
}): Promise<Record<string, UploadFileMetadata>> {
  const uploads: Record<string, UploadFileMetadata> = {};

  if (input.videoFile) {
    uploads.videoFile = await validateUploadFile(input.videoFile, VIDEO_EXTENSIONS);
  }

  if (input.imageFile) {
    uploads.imageFile = await validateUploadFile(input.imageFile, IMAGE_EXTENSIONS);
  }

  if (input.coverImageFile) {
    uploads.coverImageFile = await validateUploadFile(input.coverImageFile, IMAGE_EXTENSIONS);
  }

  return uploads;
}

export class ClassroomController {
  constructor(private readonly session: SkoolSession) {}

  async checkLogin(input: ListClassroomInput): Promise<OperationResult> {
    const page = await this.session.goto(input.communityUrl);
    const loggedIn = await this.session.isLoggedIn(page);

    return {
      ok: loggedIn,
      dryRun: false,
      operation: 'check_login',
      message: loggedIn ? 'Skool session appears to be logged in.' : 'Skool login is required in the Playwright profile.',
      data: { url: page.url(), loggedIn },
    };
  }

  async listClassroom(input: ListClassroomInput): Promise<OperationResult> {
    try {
      const page = await this.session.goto(input.communityUrl);
      const snapshot = await this.extractClassroomSnapshot(page, input.communityUrl);

      return {
        ok: true,
        dryRun: false,
        operation: 'list_classroom',
        message: `Found ${snapshot.modules.length} possible module headings.`,
        data: snapshot,
        warnings: [
          'Skool has no public API for this flow; listing uses visible page structure and may need selector tuning after login.',
        ],
      };
    } catch (error) {
      throw await this.session.captureFailure('list classroom', error);
    }
  }

  async createModule(input: CreateModuleInput): Promise<OperationResult> {
    const uploads = await collectUploadMetadata(input);

    if (!input.execute) {
      return {
        ok: true,
        dryRun: true,
        operation: 'create_module',
        message: `Dry-run: would create module "${input.title}".`,
        target: { moduleTitle: input.title, communityUrl: input.communityUrl },
        data: { uploads },
      };
    }

    try {
      const page = await this.session.goto(input.communityUrl);
      await clickFirst(page, /new module|add module|create module/i, 'create_module_button_missing');
      await fillFirst(page, /module title|title|name/i, input.title, 'module_title_input_missing');
      if (input.coverImageFile) {
        await uploadNativeFile(page, { filePath: uploads.coverImageFile.path, kind: 'cover' });
      }
      await clickFirst(page, /save|create|publish/i, 'module_save_button_missing');
      await page.getByText(input.title, { exact: false }).first().waitFor({ timeout: 10_000 });

      return {
        ok: true,
        dryRun: false,
        operation: 'create_module',
        message: `Created module "${input.title}".`,
        target: { moduleTitle: input.title, communityUrl: input.communityUrl },
      };
    } catch (error) {
      throw await this.session.captureFailure('create module', error);
    }
  }

  async createLesson(input: CreateLessonInput): Promise<OperationResult> {
    const uploads = await collectUploadMetadata(input);

    if (!input.execute) {
      return {
        ok: true,
        dryRun: true,
        operation: 'create_lesson',
        message: `Dry-run: would create lesson "${input.title}" in module "${input.moduleTitle}".`,
        target: {
          moduleTitle: input.moduleTitle,
          lessonTitle: input.title,
          communityUrl: input.communityUrl,
          videoUrl: input.videoUrl,
        },
        data: { uploads },
      };
    }

    try {
      const page = await this.session.goto(input.communityUrl);
      await page.getByText(input.moduleTitle, { exact: false }).first().click();
      await clickFirst(page, /new lesson|add lesson|create lesson/i, 'create_lesson_button_missing');
      await fillFirst(page, /lesson title|title|name/i, input.title, 'lesson_title_input_missing');

      if (input.body) {
        await fillFirst(page, /description|body|content/i, input.body, 'lesson_body_input_missing');
      }

      if (input.videoUrl) {
        await fillFirst(page, /video|url|link/i, input.videoUrl, 'lesson_video_url_input_missing');
      }

      if (input.videoFile) {
        await uploadNativeFile(page, { filePath: uploads.videoFile.path, kind: 'video' });
      }

      if (input.imageFile) {
        await uploadNativeFile(page, { filePath: uploads.imageFile.path, kind: 'image' });
      }

      await clickFirst(page, /save|create|publish/i, 'lesson_save_button_missing');
      await page.getByText(input.title, { exact: false }).first().waitFor({ timeout: 10_000 });

      return {
        ok: true,
        dryRun: false,
        operation: 'create_lesson',
        message: `Created lesson "${input.title}".`,
        target: { moduleTitle: input.moduleTitle, lessonTitle: input.title, communityUrl: input.communityUrl },
      };
    } catch (error) {
      throw await this.session.captureFailure('create lesson', error);
    }
  }

  async updateLesson(input: UpdateLessonInput): Promise<OperationResult> {
    const changedFields = changedLessonFields(input);
    const uploads = await collectUploadMetadata(input);

    if (!input.execute) {
      return {
        ok: true,
        dryRun: true,
        operation: 'update_lesson',
        message: `Dry-run: would update lesson "${input.lessonTitle ?? input.lessonUrl}".`,
        target: { lessonTitle: input.lessonTitle ?? input.lessonUrl, communityUrl: input.communityUrl },
        changedFields,
        data: { uploads },
      };
    }

    try {
      // A direct lesson URL (…/classroom/<course>?md=<unit_id>) selects the
      // exact lesson with no title ambiguity. Title-based lookup is a fallback,
      // and uses exact matching so "TRANSITIONS" never matches "TEMPLATED
      // TRANSITIONS".
      const page = await this.session.goto(input.lessonUrl ?? input.communityUrl);
      if (!input.lessonUrl) {
        if (input.moduleTitle) {
          await page.getByText(input.moduleTitle, { exact: false }).first().click();
          await page.getByText(input.lessonTitle!, { exact: true }).first().waitFor({ timeout: 15_000 });
        }
        await page.getByText(input.lessonTitle!, { exact: true }).first().click();
      } else {
        await page.waitForTimeout(2_000);
      }
      await openLessonEditor(page);

      if (input.title) {
        await setLessonTitle(page, input.title);
      }

      if (input.body) {
        await setLessonBody(page, markdownToTiptapHtml(input.body));
      }

      if (input.videoUrl) {
        await fillFirst(page, /video|url|link/i, input.videoUrl, 'lesson_video_url_input_missing');
      }

      if (input.videoFile) {
        await uploadNativeFile(page, { filePath: uploads.videoFile.path, kind: 'video' });
      }

      if (input.imageFile) {
        await uploadNativeFile(page, { filePath: uploads.imageFile.path, kind: 'image' });
      }

      const saved = await saveLessonEditor(page);
      const label = input.lessonTitle ?? input.lessonUrl;

      return {
        ok: true,
        dryRun: false,
        operation: 'update_lesson',
        message: saved
          ? `Updated lesson "${label}".`
          : `No changes to apply for lesson "${label}"; it already matches.`,
        target: { lessonTitle: label, communityUrl: input.communityUrl },
        changedFields: saved ? changedFields : [],
      };
    } catch (error) {
      throw await this.session.captureFailure('update lesson', error);
    }
  }

  async reorderLessons(input: ReorderLessonsInput): Promise<OperationResult> {
    return {
      ok: false,
      dryRun: !input.execute,
      operation: 'reorder_lessons',
      message: 'Lesson reordering is intentionally disabled until the Skool drag-and-drop UI is manually validated.',
      target: {
        moduleTitle: input.moduleTitle,
        orderedLessonTitles: input.orderedLessonTitles,
        communityUrl: input.communityUrl,
      },
      warnings: ['Reorder support is part of v1 only if the UI proves stable enough to validate safely.'],
    };
  }

  private async extractClassroomSnapshot(page: Page, communityUrl: string): Promise<ClassroomSnapshot> {
    const courseCardRecords = await page.locator('div[role="button"]').evaluateAll((cards) =>
      cards.map((card) => {
        return {
          title: card.querySelector('[class*="CourseTitle"]')?.textContent?.trim() ?? '',
          description: card.querySelector('[class*="CourseDescription"]')?.textContent?.trim() ?? '',
          progress: card.querySelector('[class*="LinearProgressWrapper"]')?.textContent?.trim() ?? '',
        };
      }),
    );
    const modules = normalizeCourseCardRecords(courseCardRecords);

    return {
      communityUrl,
      modules,
    };
  }
}
