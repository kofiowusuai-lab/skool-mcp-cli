import type { Page } from 'playwright';
import type { MapCommunityInput } from '../schemas.js';
import type { OperationResult } from './types.js';
import { SkoolSession } from './session.js';
import {
  COMMUNITY_TABS,
  type CommunityCountRecord,
  type CommunityDetailSnapshot,
  type CommunityMapManifest,
  type CommunityTabSnapshot,
  type CommunityTabSummary,
} from './community-types.js';

export const MAX_DEEP_ITEMS_PER_TAB = 10;

const KNOWN_TAB_PATHS = new Set(COMMUNITY_TABS.map((tab) => tab.path).filter((path) => path.length > 0));
const MUTATING_LABEL_PATTERN =
  /\b(save|submit|publish|create|new|add|edit|update|delete|remove|archive|invite|join|leave|ban|kick|approve|reject|cancel)\b/i;

function emptySummary(): CommunityTabSummary {
  return {
    visibleHeadings: [],
    visibleCounts: [],
    itemTitles: [],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function normalizeCommunityBaseUrl(value: string): string {
  const url = new URL(value.trim());
  const host = url.hostname.toLowerCase();

  if (host !== 'skool.com' && host !== 'www.skool.com') {
    throw new Error('Community URL must be on skool.com.');
  }

  const [communitySlug] = url.pathname.split('/').filter(Boolean);
  if (!communitySlug) {
    throw new Error('Community URL must include a community slug.');
  }

  return `https://www.skool.com/${communitySlug}`;
}

export function buildCommunityTabUrl(baseUrl: string, tab: { path: string }): string {
  const normalizedBase = normalizeCommunityBaseUrl(baseUrl);
  const path = tab.path.replace(/^\/+|\/+$/g, '');
  return path.length === 0 ? normalizedBase : `${normalizedBase}/${path}`;
}

export function isMutatingLabel(value: string): boolean {
  return MUTATING_LABEL_PATTERN.test(value.trim());
}

export function uniqueNonEmpty(values: Array<string | undefined | null>, limit = Number.POSITIVE_INFINITY): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = value?.replace(/\s+/g, ' ').trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(normalized);

    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function extractCountRecords(text: string): CommunityCountRecord[] {
  const lines = uniqueNonEmpty(text.split(/\n+/), 30);
  const records: CommunityCountRecord[] = [];

  for (const line of lines) {
    const normalized = line.replace(/\s+/g, ' ').trim();
    const leading = normalized.match(/^([0-9][0-9,]*(?:\.[0-9]+)?[kmKM]?)\s+(.{2,60})$/);
    const trailing = normalized.match(/^(.{2,60}?)\s+([0-9][0-9,]*(?:\.[0-9]+)?[kmKM]?)$/);

    if (leading) {
      records.push({ value: leading[1], label: leading[2].trim() });
    } else if (trailing) {
      records.push({ label: trailing[1].trim(), value: trailing[2] });
    }

    if (records.length >= 20) {
      break;
    }
  }

  const dedupeKeys = new Set<string>();
  return records.filter((record) => {
    const key = `${record.label}:${record.value}`;
    if (dedupeKeys.has(key)) {
      return false;
    }
    dedupeKeys.add(key);
    return true;
  });
}

async function extractBodyText(page: Page): Promise<string> {
  return page.locator('body').evaluate((element) => {
    const body = element as HTMLElement;
    return body.innerText || body.textContent || '';
  });
}

async function extractSummary(page: Page): Promise<CommunityTabSummary> {
  const visibleHeadings = await page
    .locator('h1,h2,h3,[role="heading"]')
    .evaluateAll((elements) => elements.map((element) => element.textContent ?? ''));

  const bodyText = await extractBodyText(page);

  const itemTitles = await page
    .locator('a,button,h1,h2,h3,[role="button"]')
    .evaluateAll((elements) => elements.map((element) => element.textContent ?? ''));

  return {
    visibleHeadings: uniqueNonEmpty(visibleHeadings, 20),
    visibleCounts: extractCountRecords(bodyText),
    itemTitles: uniqueNonEmpty(itemTitles.filter((title) => !isMutatingLabel(title)), 50),
  };
}

function isSameCommunityDetailUrl(candidateUrl: string, baseUrl: string): boolean {
  try {
    const candidate = new URL(candidateUrl);
    const base = new URL(baseUrl);
    if (candidate.hostname.toLowerCase() !== base.hostname.toLowerCase() || candidate.origin !== base.origin) {
      return false;
    }

    const [candidateSlug, candidateSecondPath] = candidate.pathname.split('/').filter(Boolean);
    const candidateParts = candidate.pathname.split('/').filter(Boolean);
    const [baseSlug] = base.pathname.split('/').filter(Boolean);

    if (candidateSlug !== baseSlug) {
      return false;
    }

    if (candidate.href === base.href) {
      return false;
    }

    return !(candidateParts.length === 2 && KNOWN_TAB_PATHS.has(candidateSecondPath ?? ''));
  } catch {
    return false;
  }
}

async function collectDetailCandidates(page: Page, baseUrl: string): Promise<Array<{ title: string; url: string }>> {
  const links = await page.locator('a[href]').evaluateAll((elements) =>
    elements.map((element) => ({
      title: element.textContent ?? '',
      url: (element as HTMLAnchorElement).href,
    })),
  );
  const seen = new Set<string>();
  const candidates: Array<{ title: string; url: string }> = [];

  for (const link of links) {
    const title = link.title.replace(/\s+/g, ' ').trim();
    const url = link.url.trim();
    if (!title || !url || isMutatingLabel(title) || !isSameCommunityDetailUrl(url, baseUrl) || seen.has(url)) {
      continue;
    }

    seen.add(url);
    candidates.push({ title, url });

    if (candidates.length >= MAX_DEEP_ITEMS_PER_TAB) {
      break;
    }
  }

  return candidates;
}

function comparableUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  return url.href.replace(/\/+$/, '');
}

function accessWarningsFor(tabUrl: string, finalUrl: string, bodyText: string): string[] {
  const warnings: string[] = [];
  const normalizedBody = bodyText.replace(/\s+/g, ' ').trim();

  try {
    if (comparableUrl(tabUrl) !== comparableUrl(finalUrl)) {
      warnings.push(`Tab redirected from ${tabUrl} to ${finalUrl}.`);
    }
  } catch {
    warnings.push(`Tab ended at unexpected URL ${finalUrl}.`);
  }

  if (/\b(log in|sign in)\b/i.test(normalizedBody) || /\/login\b/i.test(finalUrl)) {
    warnings.push('Tab appears to require login.');
  }

  if (/\b(access denied|not authorized|permission|404|not found)\b/i.test(normalizedBody)) {
    warnings.push('Tab appears inaccessible.');
  }

  return warnings;
}

export class CommunityController {
  constructor(private readonly session: SkoolSession) {}

  async mapCommunity(input: MapCommunityInput): Promise<OperationResult> {
    try {
      const baseUrl = normalizeCommunityBaseUrl(input.communityUrl);
      const tabs: CommunityTabSnapshot[] = [];

      for (const tab of COMMUNITY_TABS) {
        const tabUrl = buildCommunityTabUrl(baseUrl, tab);
        tabs.push(await this.scanTab(tab, tabUrl, baseUrl, input.deep === true));
      }

      const manifest: CommunityMapManifest = {
        communityUrl: baseUrl,
        scannedAt: new Date().toISOString(),
        depth: input.deep === true ? 'deep' : 'top',
        tabs,
      };

      const warningCount = tabs.reduce(
        (count, tab) => count + tab.warnings.length + (tab.details ?? []).reduce((sum, detail) => sum + detail.warnings.length, 0),
        0,
      );

      return {
        ok: true,
        dryRun: false,
        operation: 'map_community',
        message: `Mapped ${tabs.length} Skool community tabs with ${warningCount} warnings.`,
        data: manifest,
        warnings: tabs.flatMap((tab) => tab.warnings.map((warning) => `${tab.label}: ${warning}`)),
      };
    } catch (error) {
      throw await this.session.captureFailure('map community', error);
    }
  }

  private async scanTab(
    tab: (typeof COMMUNITY_TABS)[number],
    tabUrl: string,
    baseUrl: string,
    deep: boolean,
  ): Promise<CommunityTabSnapshot> {
    try {
      const page = await this.session.goto(tabUrl);
      await page.waitForTimeout(500);
      const summary = await extractSummary(page);
      const finalUrl = page.url();
      const warnings = accessWarningsFor(tabUrl, finalUrl, await extractBodyText(page));
      const accessible = !warnings.some((warning) => /require login|requires login|inaccessible/i.test(warning));
      const snapshot: CommunityTabSnapshot = {
        key: tab.key,
        label: tab.label,
        url: finalUrl,
        accessible,
        summary,
        warnings,
      };

      if (deep && accessible) {
        snapshot.details = await this.scanDetails(page, tabUrl, baseUrl);
      }

      return snapshot;
    } catch (error) {
      return {
        key: tab.key,
        label: tab.label,
        url: tabUrl,
        accessible: false,
        summary: emptySummary(),
        warnings: [errorMessage(error)],
        ...(deep ? { details: [] } : {}),
      };
    }
  }

  private async scanDetails(page: Page, tabUrl: string, baseUrl: string): Promise<CommunityDetailSnapshot[]> {
    const candidates = await collectDetailCandidates(page, baseUrl);
    const details: CommunityDetailSnapshot[] = [];

    for (const candidate of candidates) {
      try {
        const detailPage = await this.session.goto(candidate.url);
        await detailPage.waitForTimeout(500);
        const summary = await extractSummary(detailPage);
        details.push({
          title: summary.visibleHeadings[0] ?? candidate.title,
          url: detailPage.url(),
          visibleHeadings: summary.visibleHeadings,
          visibleCounts: summary.visibleCounts,
          warnings: [],
        });
      } catch (error) {
        details.push({
          title: candidate.title,
          url: candidate.url,
          visibleHeadings: [],
          visibleCounts: [],
          warnings: [errorMessage(error)],
        });
      } finally {
        await this.session.goto(tabUrl).catch(() => undefined);
      }
    }

    return details;
  }
}
