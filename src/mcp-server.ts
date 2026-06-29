#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  createLessonOperation,
  createModuleOperation,
  listClassroomOperation,
  loginOperation,
  mapCommunityOperation,
  reorderLessonsOperation,
  updateLessonOperation,
} from './core.js';
import {
  createLessonInputSchema,
  createLessonInputShape,
  createModuleInputSchema,
  createModuleInputShape,
  listClassroomInputSchema,
  baseInputShape,
  loginInputSchema,
  mapCommunityInputSchema,
  mapCommunityInputShape,
  reorderLessonsInputSchema,
  reorderLessonsInputShape,
  updateLessonInputSchema,
  updateLessonInputShape,
} from './schemas.js';
import { serializeError } from './safety/errors.js';

export const SKOOL_MCP_TOOL_NAMES = [
  'skool_check_login',
  'skool_map_community',
  'skool_list_classroom',
  'skool_create_module',
  'skool_create_lesson',
  'skool_update_lesson',
  'skool_reorder_lessons',
] as const;

type ToolResultPayload = unknown;

function jsonToolResult(payload: ToolResultPayload) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

async function runTool(schema: z.ZodTypeAny, input: unknown, handler: (parsed: any) => Promise<unknown>) {
  try {
    const parsed = schema.parse(input);
    return jsonToolResult(await handler(parsed));
  } catch (error) {
    return {
      isError: true,
      ...jsonToolResult(serializeError(error)),
    };
  }
}

export function createSkoolMcpServer(): McpServer {
  const server = new McpServer({
    name: 'skool-mcp-cli',
    version: '0.1.0',
  });

  server.registerTool(
    'skool_check_login',
    {
      title: 'Check Skool Login',
      description: 'Open the dedicated Playwright Skool profile and report whether the session appears logged in.',
      inputSchema: baseInputShape,
    },
    async (input) => runTool(loginInputSchema, input, loginOperation),
  );

  server.registerTool(
    'skool_map_community',
    {
      title: 'Map Skool Community',
      description: 'Read-only scan of visible Skool community tabs and optional bounded one-level details.',
      inputSchema: mapCommunityInputShape,
    },
    async (input) => runTool(mapCommunityInputSchema, input, mapCommunityOperation),
  );

  server.registerTool(
    'skool_list_classroom',
    {
      title: 'List Skool Classroom',
      description: 'List visible Skool Classroom modules/lessons using the dedicated Playwright profile.',
      inputSchema: baseInputShape,
    },
    async (input) => runTool(listClassroomInputSchema, input, listClassroomOperation),
  );

  server.registerTool(
    'skool_create_module',
    {
      title: 'Create Skool Module',
      description: 'Create a Skool Classroom module. Mutations default to dry-run unless execute is true.',
      inputSchema: createModuleInputShape,
    },
    async (input) => runTool(createModuleInputSchema, input, createModuleOperation),
  );

  server.registerTool(
    'skool_create_lesson',
    {
      title: 'Create Skool Lesson',
      description: 'Create a Skool lesson with title/body/external video URL. Mutations default to dry-run unless execute is true.',
      inputSchema: createLessonInputShape,
    },
    async (input) => runTool(createLessonInputSchema, input, createLessonOperation),
  );

  server.registerTool(
    'skool_update_lesson',
    {
      title: 'Update Skool Lesson',
      description: 'Update a Skool lesson title/body/external video URL. Mutations default to dry-run unless execute is true.',
      inputSchema: updateLessonInputShape,
    },
    async (input) => runTool(updateLessonInputSchema, input, updateLessonOperation),
  );

  server.registerTool(
    'skool_reorder_lessons',
    {
      title: 'Reorder Skool Lessons',
      description: 'Plan lesson reordering. Execute mode is disabled until the Skool drag-and-drop UI is manually validated.',
      inputSchema: reorderLessonsInputShape,
    },
    async (input) => runTool(reorderLessonsInputSchema, input, reorderLessonsOperation),
  );

  return server;
}

async function main(): Promise<void> {
  const server = createSkoolMcpServer();
  await server.connect(new StdioServerTransport());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
