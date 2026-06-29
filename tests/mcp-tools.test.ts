import { describe, expect, it } from 'vitest';
import { SKOOL_MCP_TOOL_NAMES, createSkoolMcpServer } from '../src/mcp-server.js';

describe('MCP server tool surface', () => {
  it('exports the v1 Skool tool names', () => {
    expect(SKOOL_MCP_TOOL_NAMES).toEqual([
      'skool_check_login',
      'skool_map_community',
      'skool_list_classroom',
      'skool_create_module',
      'skool_create_lesson',
      'skool_update_lesson',
      'skool_reorder_lessons',
    ]);
  });

  it('creates an MCP server instance', () => {
    const server = createSkoolMcpServer();

    expect(server.server).toBeDefined();
    expect(server.isConnected()).toBe(false);
  });
});
