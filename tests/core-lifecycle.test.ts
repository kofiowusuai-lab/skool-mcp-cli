import { beforeEach, describe, expect, it, vi } from 'vitest';

const closeMock = vi.fn();
const checkLoginMock = vi.fn();
const listClassroomMock = vi.fn();
const mapCommunityMock = vi.fn();
const sessionInstances: Array<{ close: typeof closeMock; options: unknown }> = [];

vi.mock('../src/skool/session.js', () => ({
  SkoolSession: vi.fn(function SkoolSession(options: unknown) {
    const instance = {
      close: closeMock,
      goto: vi.fn(),
      isLoggedIn: vi.fn().mockResolvedValue(true),
    };
    sessionInstances.push({ close: closeMock, options });
    return instance;
  }),
}));

vi.mock('../src/skool/classroom-controller.js', () => ({
  ClassroomController: vi.fn(function ClassroomController() {
    return {
      checkLogin: checkLoginMock,
      listClassroom: listClassroomMock,
    };
  }),
}));

vi.mock('../src/skool/community-controller.js', () => ({
  CommunityController: vi.fn(function CommunityController() {
    return {
      mapCommunity: mapCommunityMock,
    };
  }),
}));

describe('core operation lifecycle', () => {
  beforeEach(() => {
    closeMock.mockReset();
    checkLoginMock.mockReset();
    listClassroomMock.mockReset();
    mapCommunityMock.mockReset();
    sessionInstances.length = 0;
  });

  it('closes the Playwright session after an operation resolves', async () => {
    checkLoginMock.mockResolvedValue({
      ok: true,
      dryRun: false,
      operation: 'check_login',
      message: 'logged in',
    });

    const { loginOperation } = await import('../src/core.js');
    await loginOperation({
      communityUrl: 'https://www.skool.com/example/classroom',
    });

    expect(closeMock).toHaveBeenCalledTimes(2);
  });

  it('closes the Playwright session after an operation rejects', async () => {
    checkLoginMock.mockRejectedValue(new Error('navigation failed'));

    const { loginOperation } = await import('../src/core.js');
    await expect(
      loginOperation({
        communityUrl: 'https://www.skool.com/example/classroom',
      }),
    ).rejects.toThrow('navigation failed');

    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('opens a headed login window and retries when a headless check is logged out', async () => {
    checkLoginMock
      .mockResolvedValueOnce({
        ok: false,
        dryRun: false,
        operation: 'check_login',
        message: 'login required',
      })
      .mockResolvedValueOnce({
        ok: true,
        dryRun: false,
        operation: 'check_login',
        message: 'logged in',
      });
    listClassroomMock.mockResolvedValue({
      ok: true,
      dryRun: false,
      operation: 'list_classroom',
      message: 'listed',
    });

    const { listClassroomOperation } = await import('../src/core.js');
    await listClassroomOperation({
      communityUrl: 'https://www.skool.com/example/classroom',
    });

    expect(checkLoginMock).toHaveBeenCalledTimes(2);
    expect(listClassroomMock).toHaveBeenCalledTimes(1);
    expect(sessionInstances.map((instance) => instance.options)).toEqual([
      expect.objectContaining({ headless: true }),
      expect.objectContaining({ headless: false }),
      expect.objectContaining({ headless: true }),
    ]);
  });

  it('maps the community through the community controller and closes the Playwright session', async () => {
    checkLoginMock.mockResolvedValue({
      ok: true,
      dryRun: false,
      operation: 'check_login',
      message: 'logged in',
    });
    mapCommunityMock.mockResolvedValue({
      ok: true,
      dryRun: false,
      operation: 'map_community',
      message: 'mapped',
      data: { tabs: [] },
    });

    const { mapCommunityOperation } = await import('../src/core.js');
    const input = {
      communityUrl: 'https://www.skool.com/example/calendar',
      deep: true,
      profileDir: '.profiles/test',
      artifactDir: '.artifacts/test',
      headless: false,
      autoLogin: false,
    };
    const result = await mapCommunityOperation(input);

    expect(result).toEqual({
      ok: true,
      dryRun: false,
      operation: 'map_community',
      message: 'mapped',
      data: { tabs: [] },
    });
    expect(mapCommunityMock).toHaveBeenCalledTimes(1);
    expect(mapCommunityMock).toHaveBeenCalledWith({
      communityUrl: 'https://www.skool.com/example/calendar',
      deep: true,
      profileDir: '.profiles/test',
      artifactDir: '.artifacts/test',
      headless: false,
      autoLogin: false,
    });
    expect(sessionInstances.map((instance) => instance.options)).toEqual([
      {
        profileDir: '.profiles/test',
        artifactDir: '.artifacts/test',
        headless: false,
      },
      {
        profileDir: '.profiles/test',
        artifactDir: '.artifacts/test',
        headless: false,
      },
    ]);
    expect(closeMock).toHaveBeenCalledTimes(2);
  });

  it('fails fast for community mapping when login is required and auto-login is disabled', async () => {
    checkLoginMock.mockResolvedValue({
      ok: false,
      dryRun: false,
      operation: 'check_login',
      message: 'login required',
    });

    const { mapCommunityOperation } = await import('../src/core.js');
    await expect(
      mapCommunityOperation({
        communityUrl: 'https://www.skool.com/example',
        autoLogin: false,
      }),
    ).rejects.toThrow('login required');

    expect(mapCommunityMock).not.toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
