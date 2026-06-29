export type SkoolAutomationErrorOptions = {
  url?: string;
  screenshotPath?: string;
  tracePath?: string;
  details?: Record<string, unknown>;
};

export type SerializedSkoolAutomationError = {
  code: string;
  message: string;
  url?: string;
  screenshotPath?: string;
  tracePath?: string;
  details?: Record<string, unknown>;
};

export class SkoolAutomationError extends Error {
  readonly code: string;
  readonly url?: string;
  readonly screenshotPath?: string;
  readonly tracePath?: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, options: SkoolAutomationErrorOptions = {}) {
    super(message);
    this.name = 'SkoolAutomationError';
    this.code = code;
    this.url = options.url;
    this.screenshotPath = options.screenshotPath;
    this.tracePath = options.tracePath;
    this.details = options.details;
  }

  toJSON(): SerializedSkoolAutomationError {
    return {
      code: this.code,
      message: this.message,
      url: this.url,
      screenshotPath: this.screenshotPath,
      tracePath: this.tracePath,
      details: this.details,
    };
  }
}

export function serializeError(error: unknown): SerializedSkoolAutomationError {
  if (error instanceof SkoolAutomationError) {
    return error.toJSON();
  }

  if (error instanceof Error) {
    return {
      code: 'unexpected_error',
      message: error.message,
    };
  }

  return {
    code: 'unexpected_error',
    message: String(error),
  };
}
