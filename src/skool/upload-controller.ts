import type { Page } from 'playwright';
import { SkoolAutomationError } from '../safety/errors.js';

export type NativeUploadKind = 'video' | 'image' | 'cover';

export type NativeUploadInput = {
  filePath: string;
  kind: NativeUploadKind;
};

function uploadLabels(kind: NativeUploadKind): RegExp {
  if (kind === 'video') {
    return /upload video|add video|video|media/i;
  }

  if (kind === 'cover') {
    return /upload cover|cover|thumbnail|image/i;
  }

  return /upload image|add image|image|photo|media/i;
}

export async function uploadNativeFile(page: Page, input: NativeUploadInput): Promise<void> {
  const label = uploadLabels(input.kind);

  const directInputs = page.locator('input[type="file"]');
  if ((await directInputs.count()) > 0) {
    await directInputs.first().setInputFiles(input.filePath);
    await waitForUploadSettled(page);
    return;
  }

  const trigger = page.getByText(label).first();
  if ((await trigger.count()) > 0) {
    await trigger.click();
  }

  const inputsAfterTrigger = page.locator('input[type="file"]');
  if ((await inputsAfterTrigger.count()) > 0) {
    await inputsAfterTrigger.first().setInputFiles(input.filePath);
    await waitForUploadSettled(page);
    return;
  }

  throw new SkoolAutomationError('native_upload_input_missing', `Could not find native Skool ${input.kind} upload control.`, {
    url: page.url(),
    details: { kind: input.kind },
  });
}

async function waitForUploadSettled(page: Page): Promise<void> {
  await page.waitForTimeout(1000);

  const uploading = page.getByText(/uploading|processing|encoding|transcoding/i);
  const count = await uploading.count().catch(() => 0);

  if (count > 0) {
    await uploading.first().waitFor({ state: 'detached', timeout: 120_000 }).catch(async () => {
      throw new SkoolAutomationError('native_upload_completion_timeout', 'Skool upload did not finish within 120 seconds.', {
        url: page.url(),
      });
    });
  }
}
