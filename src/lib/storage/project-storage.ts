import fs from 'fs';
import path from 'path';

export const PROJECT_SUBDIRECTORIES = [
  'characters',
  'character-references',
  'storyboards',
  'images',
  'videos',
  'lipsync',
  'narration',
  'dialogue',
  'music',
  'ambience',
  'sfx',
  'subtitles',
  'renders',
  'benchmarks',
  'logs',
  'manual-packages',
] as const;

export type ProjectSubdirectory = (typeof PROJECT_SUBDIRECTORIES)[number];

/**
 * Gets the root data directory. Defaults to ./data or OPENSTORY_DATA_DIR env variable.
 */
export function getDataRootDir(): string {
  const customDir = process.env.OPENSTORY_DATA_DIR || process.env.STORYFLOW_DATA_DIR;
  if (customDir) {
    return path.resolve(customDir);
  }
  return path.resolve(process.cwd(), 'data');
}

/**
 * Gets the root directory for a specific project.
 */
export function getProjectDir(projectId: string): string {
  return path.join(getDataRootDir(), 'projects', projectId);
}

/**
 * Ensures the project folder hierarchy exists on disk.
 */
export function ensureProjectStorage(projectId: string): string {
  const projectDir = getProjectDir(projectId);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  for (const subdir of PROJECT_SUBDIRECTORIES) {
    const dirPath = path.join(projectDir, subdir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  return projectDir;
}

/**
 * Generates a non-destructive unique media filename.
 * Pattern: {baseName}_{timestamp}_{randomHex}.{ext}
 */
export function generateMediaFilename(
  baseName: string,
  extension: string
): string {
  const sanitized = baseName.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 40);
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const cleanExt = extension.startsWith('.') ? extension.slice(1) : extension;
  return `${sanitized}_${timestamp}_${randomSuffix}.${cleanExt}`;
}

/**
 * Resolves the relative path within project to absolute disk path.
 */
export function resolveProjectPath(projectId: string, relativePath: string): string {
  return path.join(getProjectDir(projectId), relativePath);
}

/** Resolves either a project-relative asset path or a legacy data-root-relative path. */
export function resolveStoredMediaPath(projectId: string, storedPath: string): string {
  if (path.isAbsolute(storedPath)) return storedPath;
  const normalized = storedPath.replace(/\\/g, '/');
  if (normalized.startsWith('projects/')) {
    return path.join(/* turbopackIgnore: true */ getDataRootDir(), ...normalized.split('/'));
  }
  return path.join(/* turbopackIgnore: true */ getProjectDir(projectId), ...normalized.split('/'));
}

/**
 * Safely saves media buffer or string without overwriting existing files.
 * Returns the relative project path (e.g. "images/shot_1_1729000000_abc.png").
 */
export async function saveProjectMediaFile(
  projectId: string,
  subdir: ProjectSubdirectory,
  baseName: string,
  extension: string,
  data: Buffer | string
): Promise<{ absolutePath: string; relativePath: string; filename: string }> {
  ensureProjectStorage(projectId);

  const filename = generateMediaFilename(baseName, extension);
  const relativePath = path.posix.join(subdir, filename);
  const absolutePath = path.join(getProjectDir(projectId), subdir, filename);

  if (fs.existsSync(absolutePath)) {
    // Failsafe collision prevention
    return saveProjectMediaFile(projectId, subdir, `${baseName}_retry`, extension, data);
  }

  if (typeof data === 'string') {
    await fs.promises.writeFile(absolutePath, data, 'utf-8');
  } else {
    await fs.promises.writeFile(absolutePath, data);
  }

  return { absolutePath, relativePath, filename };
}

/**
 * Writes or updates project.json snapshot in the project root.
 */
export async function saveProjectManifest(
  projectId: string,
  manifestData: Record<string, any>
): Promise<string> {
  const projectDir = ensureProjectStorage(projectId);
  const manifestPath = path.join(projectDir, 'project.json');
  await fs.promises.writeFile(
    manifestPath,
    JSON.stringify(manifestData, null, 2),
    'utf-8'
  );
  return manifestPath;
}

/**
 * Reads project.json manifest if present.
 */
export async function readProjectManifest(
  projectId: string
): Promise<Record<string, any> | null> {
  const manifestPath = path.join(getProjectDir(projectId), 'project.json');
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  const content = await fs.promises.readFile(manifestPath, 'utf-8');
  return JSON.parse(content);
}
