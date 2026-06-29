import { describe, expect, it, vi } from 'vitest';
import { COMMUNITY_TABS } from '../src/skool/community-types.js';
import {
  buildCommunityTabUrl,
  CommunityController,
  isMutatingLabel,
  MAX_DEEP_ITEMS_PER_TAB,
  normalizeCommunityBaseUrl,
  uniqueNonEmpty,
} from '../src/skool/community-controller.js';

const tabPath = (key: string): string => {
  const tab = COMMUNITY_TABS.find((candidate) => candidate.key === key);
  if (!tab) {
    throw new Error(`Unknown test tab ${key}`);
  }
  return tab.path;
};

type FakeElement = {
  textContent?: string | null;
  href?: string;
};

class FakeLocator {
  constructor(
    private readonly elements: FakeElement[] = [],
    private readonly bodyText = '',
  ) {}

  async evaluateAll<T>(callback: (elements: FakeElement[]) => T): Promise<T> {
    return callback(this.elements);
  }

  async evaluate<T>(callback: (element: { innerText: string; textContent: string }) => T): Promise<T> {
    return callback({ innerText: this.bodyText, textContent: this.bodyText });
  }
}

type FakePageState = {
  url: string;
  headings?: string[];
  bodyText?: string;
  items?: string[];
  links?: FakeElement[];
  fail?: Error;
};

class FakePage {
  private currentUrl = '';
  readonly waitForTimeout = vi.fn(async () => undefined);

  constructor(private readonly states: Record<string, FakePageState>) {}

  url(): string {
    return this.states[this.currentUrl]?.url ?? this.currentUrl;
  }

  locator(selector: string): FakeLocator {
    const state = this.states[this.currentUrl] ?? { url: this.currentUrl };
    if (selector === 'h1,h2,h3,[role="heading"]') {
      return new FakeLocator((state.headings ?? []).map((textContent) => ({ textContent })));
    }
    if (selector === 'body') {
      return new FakeLocator([], state.bodyText ?? '');
    }
    if (selector === 'a,button,h1,h2,h3,[role="button"]') {
      return new FakeLocator((state.items ?? []).map((textContent) => ({ textContent })));
    }
    if (selector === 'a[href]') {
      return new FakeLocator(state.links ?? []);
    }
    return new FakeLocator();
  }

  async goto(url: string): Promise<void> {
    const state = this.states[url];
    if (state?.fail) {
      throw state.fail;
    }
    this.currentUrl = url;
  }
}

class FakeSession {
  readonly goto = vi.fn(async (url: string) => {
    await this.page.goto(url);
    return this.page;
  });

  constructor(readonly page: FakePage) {}
}

describe('community URL helpers', () => {
  it('normalizes base and tab URLs to the community base URL', () => {
    expect(normalizeCommunityBaseUrl('https://www.skool.com/example')).toBe('https://www.skool.com/example');
    expect(normalizeCommunityBaseUrl('https://www.skool.com/example/')).toBe('https://www.skool.com/example');
    expect(normalizeCommunityBaseUrl('https://www.skool.com/example/classroom')).toBe('https://www.skool.com/example');
    expect(normalizeCommunityBaseUrl('https://www.skool.com/example/calendar?x=1')).toBe('https://www.skool.com/example');
  });

  it('builds known tab URLs from the normalized community base', () => {
    expect(buildCommunityTabUrl('https://www.skool.com/example', { path: '' })).toBe('https://www.skool.com/example');
    expect(buildCommunityTabUrl('https://www.skool.com/example', { path: 'calendar' })).toBe(
      'https://www.skool.com/example/calendar',
    );
  });

  it('detects labels that would mutate community state', () => {
    expect(isMutatingLabel('Save')).toBe(true);
    expect(isMutatingLabel('Invite member')).toBe(true);
    expect(isMutatingLabel('Delete post')).toBe(true);
    expect(isMutatingLabel('Monthly call')).toBe(false);
  });

  it('returns unique non-empty trimmed values with an optional cap', () => {
    expect(uniqueNonEmpty(['  Alpha  ', '', undefined, 'Beta', 'Alpha', null, 'Gamma'], 2)).toEqual(['Alpha', 'Beta']);
    expect(uniqueNonEmpty(['One', 'one', 'Two'])).toEqual(['One', 'one', 'Two']);
  });
});

describe('CommunityController.mapCommunity', () => {
  it('scans every community tab and tolerates individual tab failures', async () => {
    const baseUrl = 'https://www.skool.com/example';
    const states: Record<string, FakePageState> = Object.fromEntries(
      COMMUNITY_TABS.map((tab) => [
        buildCommunityTabUrl(baseUrl, tab),
        {
          url: buildCommunityTabUrl(baseUrl, tab),
          headings: [`${tab.label} Heading`],
          bodyText: `2 ${tab.label} items`,
          items: [`${tab.label} Item`, 'Save'],
        },
      ]),
    );
    const mapUrl = buildCommunityTabUrl(baseUrl, { path: tabPath('map') });
    states[mapUrl] = {
      url: mapUrl,
      fail: new Error('map unavailable'),
    };
    const session = new FakeSession(new FakePage(states));
    const controller = new CommunityController(session as never);

    const result = await controller.mapCommunity({ communityUrl: `${baseUrl}/calendar`, deep: false });

    expect(result).toMatchObject({
      ok: true,
      dryRun: false,
      operation: 'map_community',
    });
    expect(session.goto).toHaveBeenCalledTimes(COMMUNITY_TABS.length);
    expect(result.data).toMatchObject({
      communityUrl: baseUrl,
      depth: 'top',
    });
    const manifest = result.data as { tabs: Array<{ key: string; accessible: boolean; warnings: string[] }> };
    expect(manifest.tabs).toHaveLength(COMMUNITY_TABS.length);
    expect(manifest.tabs.find((tab) => tab.key === 'community')).toMatchObject({
      accessible: true,
    });
    expect(manifest.tabs.find((tab) => tab.key === 'map')).toMatchObject({
      accessible: false,
      warnings: ['map unavailable'],
    });
  });

  it('deep scans same-community non-mutating links up to the per-tab cap', async () => {
    const baseUrl = 'https://www.skool.com/example';
    const states: Record<string, FakePageState> = Object.fromEntries(
      COMMUNITY_TABS.map((tab) => [
        buildCommunityTabUrl(baseUrl, tab),
        {
          url: buildCommunityTabUrl(baseUrl, tab),
          headings: [`${tab.label} Heading`],
          bodyText: '',
          items: [`${tab.label} Item`],
          links:
            tab.key === 'community'
              ? [
                  ...Array.from({ length: MAX_DEEP_ITEMS_PER_TAB + 2 }, (_, index) => ({
                    textContent: `Detail ${index + 1}`,
                    href: `${baseUrl}/post-${index + 1}`,
                  })),
                  { textContent: 'Delete post', href: `${baseUrl}/danger` },
                  { textContent: 'Outside', href: 'https://www.example.com/outside' },
                ]
              : [],
        },
      ]),
    );
    for (let index = 1; index <= MAX_DEEP_ITEMS_PER_TAB + 2; index += 1) {
      states[`${baseUrl}/post-${index}`] = {
        url: `${baseUrl}/post-${index}`,
        headings: [`Detail ${index}`],
        bodyText: `${index} replies`,
        items: [`Detail ${index}`],
      };
    }
    const session = new FakeSession(new FakePage(states));
    const controller = new CommunityController(session as never);

    const result = await controller.mapCommunity({ communityUrl: baseUrl, deep: true });
    const manifest = result.data as { tabs: Array<{ key: string; details?: Array<{ url: string; title?: string }> }> };
    const community = manifest.tabs.find((tab) => tab.key === 'community');

    expect(manifest).toMatchObject({ depth: 'deep' });
    expect(community?.details).toHaveLength(MAX_DEEP_ITEMS_PER_TAB);
    expect(community?.details?.map((detail) => detail.url)).toEqual(
      Array.from({ length: MAX_DEEP_ITEMS_PER_TAB }, (_, index) => `${baseUrl}/post-${index + 1}`),
    );
    expect(session.goto).not.toHaveBeenCalledWith(`${baseUrl}/danger`);
    expect(session.goto).not.toHaveBeenCalledWith('https://www.example.com/outside');
  });

  it('allows detail links under known tab paths but skips exact tab URLs', async () => {
    const baseUrl = 'https://www.skool.com/example';
    const states: Record<string, FakePageState> = Object.fromEntries(
      COMMUNITY_TABS.map((tab) => [
        buildCommunityTabUrl(baseUrl, tab),
        {
          url: buildCommunityTabUrl(baseUrl, tab),
          headings: [`${tab.label} Heading`],
          bodyText: '',
          items: [`${tab.label} Item`],
          links:
            tab.key === 'calendar'
              ? [
                  { textContent: 'Calendar tab', href: `${baseUrl}/calendar` },
                  { textContent: 'Monthly call', href: `${baseUrl}/calendar/monthly-call` },
                ]
              : [],
        },
      ]),
    );
    states[`${baseUrl}/calendar/monthly-call`] = {
      url: `${baseUrl}/calendar/monthly-call`,
      headings: ['Monthly call'],
      bodyText: '8 attendees',
      items: ['Monthly call'],
    };
    const session = new FakeSession(new FakePage(states));
    const controller = new CommunityController(session as never);

    const result = await controller.mapCommunity({ communityUrl: baseUrl, deep: true });
    const manifest = result.data as { tabs: Array<{ key: string; details?: Array<{ url: string; title?: string }> }> };
    const calendar = manifest.tabs.find((tab) => tab.key === 'calendar');

    expect(calendar?.details).toEqual([
      expect.objectContaining({
        title: 'Monthly call',
        url: `${baseUrl}/calendar/monthly-call`,
      }),
    ]);
    expect(session.goto.mock.calls.filter(([url]) => url === `${baseUrl}/calendar`)).toHaveLength(2);
  });

  it('records redirect and access warnings without aborting the scan', async () => {
    const baseUrl = 'https://www.skool.com/example';
    const states: Record<string, FakePageState> = Object.fromEntries(
      COMMUNITY_TABS.map((tab) => [
        buildCommunityTabUrl(baseUrl, tab),
        {
          url: buildCommunityTabUrl(baseUrl, tab),
          headings: [`${tab.label} Heading`],
          bodyText: '',
          items: [`${tab.label} Item`],
        },
      ]),
    );
    const leaderboardsUrl = buildCommunityTabUrl(baseUrl, { path: tabPath('leaderboards') });
    states[leaderboardsUrl] = {
      url: `${baseUrl}/login`,
      headings: ['Log in'],
      bodyText: 'Log in to continue',
      items: ['Log in'],
    };
    const session = new FakeSession(new FakePage(states));
    const controller = new CommunityController(session as never);

    const result = await controller.mapCommunity({ communityUrl: baseUrl, deep: false });
    const manifest = result.data as { tabs: Array<{ key: string; accessible: boolean; warnings: string[] }> };
    const leaderboard = manifest.tabs.find((tab) => tab.key === 'leaderboards');

    expect(leaderboard).toMatchObject({
      accessible: false,
      warnings: [
        `Tab redirected from ${leaderboardsUrl} to ${baseUrl}/login.`,
        'Tab appears to require login.',
      ],
    });
  });
});
