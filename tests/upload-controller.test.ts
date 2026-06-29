import { describe, expect, it, vi } from 'vitest';
import { uploadNativeFile } from '../src/skool/upload-controller.js';

describe('uploadNativeFile', () => {
  it('sets the first file input when available', async () => {
    const setInputFiles = vi.fn();
    const page = {
      locator: vi.fn(() => ({
        count: vi.fn().mockResolvedValue(1),
        first: vi.fn(() => ({
          setInputFiles,
        })),
      })),
      waitForTimeout: vi.fn(),
      getByText: vi.fn(() => ({
        count: vi.fn().mockResolvedValue(0),
      })),
    };

    await uploadNativeFile(page as never, {
      filePath: '/tmp/video.mp4',
      kind: 'video',
    });

    expect(setInputFiles).toHaveBeenCalledWith('/tmp/video.mp4');
  });
});
