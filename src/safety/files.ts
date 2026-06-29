import fs from 'node:fs/promises';
import path from 'node:path';

export type UploadFileMetadata = {
  path: string;
  extension: string;
  sizeBytes: number;
};

export const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm'];
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

export async function validateUploadFile(filePath: string, allowedExtensions: string[]): Promise<UploadFileMetadata> {
  const resolvedPath = path.resolve(filePath);
  const extension = path.extname(resolvedPath).toLowerCase();

  if (!allowedExtensions.includes(extension)) {
    throw new Error(`Unsupported upload file extension "${extension}". Allowed: ${allowedExtensions.join(', ')}`);
  }

  const stat = await fs.stat(resolvedPath);

  if (!stat.isFile()) {
    throw new Error(`Upload path is not a file: ${resolvedPath}`);
  }

  if (stat.size <= 0) {
    throw new Error(`Upload file is empty: ${resolvedPath}`);
  }

  return {
    path: resolvedPath,
    extension,
    sizeBytes: stat.size,
  };
}
