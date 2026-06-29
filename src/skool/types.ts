export type OperationName =
  | 'check_login'
  | 'list_classroom'
  | 'map_community'
  | 'create_module'
  | 'create_lesson'
  | 'update_lesson'
  | 'reorder_lessons'
  | 'batch_apply';

export type OperationResult = {
  ok: boolean;
  dryRun: boolean;
  operation: OperationName;
  message: string;
  target?: Record<string, unknown>;
  changedFields?: string[];
  data?: unknown;
  warnings?: string[];
  artifacts?: {
    screenshotPath?: string;
    tracePath?: string;
  };
};

export type ClassroomModule = {
  title: string;
  description?: string;
  progress?: string;
  lessons: Array<{
    title: string;
  }>;
};

export type ClassroomSnapshot = {
  communityUrl: string;
  modules: ClassroomModule[];
};
