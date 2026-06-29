import fs from 'node:fs/promises';
import type { BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import { makeArtifactPaths } from '../safety/artifacts.js';
import { SkoolAutomationError } from '../safety/errors.js';

export type SkoolSessionOptions = {
  profileDir: string;
  artifactDir: string;
  headless: boolean;
};

export class SkoolSession {
  private context?: BrowserContext;
  private activePage?: Page;

  constructor(private readonly options: SkoolSessionOptions) {}

  async open(): Promise<Page> {
    if (this.activePage) {
      return this.activePage;
    }

    await fs.mkdir(this.options.profileDir, { recursive: true });
    await fs.mkdir(this.options.artifactDir, { recursive: true });

    this.context = await chromium.launchPersistentContext(this.options.profileDir, {
      channel: 'chrome',
      headless: this.options.headless,
      viewport: { width: 1440, height: 1000 },
    });

    this.activePage = this.context.pages()[0] ?? (await this.context.newPage());
    return this.activePage;
  }

  async goto(url: string): Promise<Page> {
    const page = await this.open();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return page;
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    const currentUrl = page.url();
    if (/\/(login|signup|register)(?:\b|\/|\?)/i.test(currentUrl)) {
      return false;
    }

    const loginIndicators = page.getByText(/\b(log\s?in|sign\s?in|sign\s?up)\b/i);
    const loginCount = await loginIndicators.count().catch(() => 0);
    return loginCount === 0 && currentUrl.includes('skool.com');
  }

  async captureFailure(operationName: string, error: unknown): Promise<SkoolAutomationError> {
    const page = this.activePage;
    const paths = makeArtifactPaths(this.options.artifactDir, operationName);

    if (page) {
      await fs.mkdir(this.options.artifactDir, { recursive: true });
      await page.screenshot({ path: paths.screenshotPath, fullPage: true }).catch(() => undefined);
    }

    if (error instanceof SkoolAutomationError) {
      return new SkoolAutomationError(error.code, error.message, {
        url: page?.url() ?? error.url,
        screenshotPath: paths.screenshotPath,
        tracePath: paths.tracePath,
        details: error.details,
      });
    }

    return new SkoolAutomationError('playwright_action_failed', error instanceof Error ? error.message : String(error), {
      url: page?.url(),
      screenshotPath: paths.screenshotPath,
      tracePath: paths.tracePath,
    });
  }

  async close(): Promise<void> {
    await this.context?.close();
    this.context = undefined;
    this.activePage = undefined;
  }
}
