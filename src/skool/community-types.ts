export type CommunityMapDepth = 'top' | 'deep';

export type CommunityTabKey =
  | 'community'
  | 'classroom'
  | 'calendar'
  | 'members'
  | 'map'
  | 'leaderboards'
  | 'about';

export type CommunityCountRecord = {
  label: string;
  value: string;
};

export type CommunityTabSummary = {
  visibleHeadings: string[];
  visibleCounts: CommunityCountRecord[];
  itemTitles: string[];
};

export type CommunityDetailSnapshot = {
  title?: string;
  url: string;
  visibleHeadings: string[];
  visibleCounts: CommunityCountRecord[];
  warnings: string[];
};

export type CommunityTabSnapshot = {
  key: CommunityTabKey;
  label: string;
  url?: string;
  accessible: boolean;
  summary: CommunityTabSummary;
  details?: CommunityDetailSnapshot[];
  warnings: string[];
};

export type CommunityMapManifest = {
  communityUrl: string;
  scannedAt: string;
  depth: CommunityMapDepth;
  tabs: CommunityTabSnapshot[];
};

export const COMMUNITY_TABS: Array<{ key: CommunityTabKey; label: string; path: string }> = [
  { key: 'community', label: 'Community', path: '' },
  { key: 'classroom', label: 'Classroom', path: 'classroom' },
  { key: 'calendar', label: 'Calendar', path: 'calendar' },
  { key: 'members', label: 'Members', path: '-/members' },
  { key: 'map', label: 'Map', path: '-/map' },
  { key: 'leaderboards', label: 'Leaderboards', path: '-/leaderboards' },
  { key: 'about', label: 'About', path: 'about' },
];
