import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import {
  ensureProjectStorage,
  getProjectDir,
  PROJECT_SUBDIRECTORIES,
  saveProjectManifest,
} from '@/lib/storage/project-storage';

export interface ExportZipResult {
  zipBuffer: Buffer;
  filename: string;
}

export interface ImportZipResult {
  projectId: string;
  name: string;
}

export const MAX_ARCHIVE_COMPRESSED_BYTES = 250 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 5_000;
const MAX_ARCHIVE_ENTRY_BYTES = 512 * 1024 * 1024;
const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 5 * 1024 * 1024;

const ArchiveManifestSchema = z.object({
  format: z.literal('openstory-archive').optional(),
  schemaVersion: z.string().max(32).default('1.0.0'),
  project: z.object({
    id: z.string().max(200).optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(20_000).nullable().optional(),
    aspectRatio: z.string().max(20).optional(),
    fps: z.number().int().min(1).max(120).optional(),
    targetLanguage: z.string().max(30).optional(),
    currentPhase: z.string().max(80).optional(),
    budgetLimit: z.number().nonnegative().nullable().optional(),
    shotPlanningMode: z.enum(['SCENE_AS_SHOT', 'MULTI_SHOT']).optional(),
  }).passthrough(),
  styleBible: z.record(z.any()).nullable().optional(),
  characters: z.array(z.record(z.any())).max(1_000).default([]),
  scenes: z.array(z.record(z.any())).max(10_000).default([]),
  allAssetVersions: z.array(z.record(z.any())).max(50_000).default([]),
  pronunciations: z.array(z.record(z.any())).max(10_000).default([]),
}).passthrough();

export function normalizedEntryName(entryName: string): string {
  const normalized = entryName.replace(/\\/g, '/');
  if (
    normalized.includes('\0') ||
    normalized.startsWith('/') ||
    /^[a-zA-Z]:/.test(normalized) ||
    normalized.split('/').some((part) => part === '..')
  ) {
    throw new Error(`Unsafe path in project archive: ${entryName}`);
  }
  return normalized;
}

export function mediaRelativePath(entryName: string): string | null {
  const normalized = normalizedEntryName(entryName);
  const parts = normalized.split('/').filter(Boolean);
  const mediaIndex = parts.indexOf('media');
  if (mediaIndex < 0) return null;
  const relativeParts = parts.slice(mediaIndex + 1);
  if (relativeParts.length < 2 || !PROJECT_SUBDIRECTORIES.includes(relativeParts[0] as any)) return null;
  return relativeParts.join('/');
}

export function resolveArchiveDestination(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const destination = path.resolve(resolvedRoot, ...relativePath.split('/'));
  if (!destination.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Archive path escapes project directory: ${relativePath}`);
  }
  return destination;
}

export class ProjectArchiveService {
  /**
   * Bundles an entire video project (database records + all media assets on disk)
   * into a single downloadable .zip archive.
   */
  static async exportProjectZip(projectId: string): Promise<ExportZipResult> {
    // 1. Fetch full project data from SQLite
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        styleBible: true,
        characters: {
          include: {
            references: true,
          },
        },
        scenes: {
          orderBy: { sceneNumber: 'asc' },
          include: {
            characters: true,
            shots: true,
            assetVersions: true,
          },
        },
        assetVersions: true,
        pronunciations: true,
      },
    });

    if (!project) {
      throw new Error(`Project with ID ${projectId} not found.`);
    }

    // 2. Build the unified project.json manifest
    const manifest = {
      format: 'openstory-archive',
      schemaVersion: project.schemaVersion || '1.0.0',
      exportedAt: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        aspectRatio: project.aspectRatio,
        fps: project.fps,
        targetLanguage: project.targetLanguage,
        currentPhase: project.currentPhase,
        budgetLimit: project.budgetLimit,
        shotPlanningMode: project.shotPlanningMode,
      },
      styleBible: project.styleBible,
      characters: project.characters,
      scenes: project.scenes,
      allAssetVersions: project.assetVersions,
      pronunciations: project.pronunciations,
    };

    // 3. Create zip container and add project.json
    const zip = new AdmZip();
    const manifestJsonString = JSON.stringify(manifest, null, 2);
    zip.addFile('project.json', Buffer.from(manifestJsonString, 'utf-8'));

    // 4. Collect and add all media files from local disk
    const projectDiskDir = getProjectDir(projectId);
    if (fs.existsSync(projectDiskDir)) {
      for (const subdir of PROJECT_SUBDIRECTORIES) {
        const subdirPath = path.join(projectDiskDir, subdir);
        if (fs.existsSync(subdirPath)) {
          const files = fs.readdirSync(subdirPath);
          if (files.length > 0) {
            // Add entire folder under media/{subdir}
            zip.addLocalFolder(subdirPath, `media/${subdir}`);
          }
        }
      }
    }

    // 5. Generate sanitized filename
    const cleanName = project.name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 40)
      .replace(/^_+|_+$/g, '') || 'openstory_project';
    const filename = `${cleanName}_backup.zip`;

    const zipBuffer = zip.toBuffer();
    return { zipBuffer, filename };
  }

  /**
   * Imports an entire video project from an uploaded .zip archive,
   * restoring all database records and unpacking media files into local disk storage.
   */
  static async importProjectZip(zipBuffer: Buffer): Promise<ImportZipResult> {
    if (zipBuffer.length === 0 || zipBuffer.length > MAX_ARCHIVE_COMPRESSED_BYTES) {
      throw new Error('Project archive is empty or exceeds the 250 MB compressed upload limit.');
    }
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    if (entries.length === 0 || entries.length > MAX_ARCHIVE_ENTRIES) {
      throw new Error(`Project archive must contain between 1 and ${MAX_ARCHIVE_ENTRIES} entries.`);
    }

    let totalUncompressedBytes = 0;
    for (const entry of entries) {
      normalizedEntryName(entry.entryName);
      const size = Number((entry.header as any).size || 0);
      if (!Number.isSafeInteger(size) || size < 0 || size > MAX_ARCHIVE_ENTRY_BYTES) {
        throw new Error(`Archive entry is too large: ${entry.entryName}`);
      }
      totalUncompressedBytes += size;
      if (totalUncompressedBytes > MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
        throw new Error('Project archive expands beyond the 2 GB safety limit.');
      }
    }

    // 1. Locate and parse project.json
    const manifestEntry = entries.find(
      (e) => e.entryName === 'project.json' || e.entryName.endsWith('/project.json')
    );

    if (!manifestEntry) {
      throw new Error('Invalid OpenStory project archive: project.json manifest not found inside ZIP.');
    }

    if (Number((manifestEntry.header as any).size || 0) > MAX_MANIFEST_BYTES) {
      throw new Error('Project manifest exceeds the 5 MB safety limit.');
    }

    let manifest: z.infer<typeof ArchiveManifestSchema>;
    try {
      manifest = ArchiveManifestSchema.parse(JSON.parse(manifestEntry.getData().toString('utf-8')));
    } catch (err: any) {
      throw new Error(`Failed to parse project.json manifest: ${err.message}`);
    }

    const oldProjectId = manifest.project.id || 'old_project';

    // 2. Create new Project in SQLite
    const createdProject = await prisma.project.create({
      data: {
        name: `${manifest.project.name} (Restored)`,
        description: manifest.project.description,
        aspectRatio: manifest.project.aspectRatio || '16:9',
        fps: manifest.project.fps || 24,
        targetLanguage: manifest.project.targetLanguage || 'hi-IN',
        schemaVersion: manifest.schemaVersion || '1.0.0',
        currentPhase: manifest.project.currentPhase || 'STORY_IMPORT',
        budgetLimit: manifest.project.budgetLimit,
        shotPlanningMode: manifest.project.shotPlanningMode || 'SCENE_AS_SHOT',
      },
    });

    const newProjectId = createdProject.id;
    const newProjectDiskDir = ensureProjectStorage(newProjectId);

    try {
      // 3. Extract only recognized media paths, with canonical boundary checks.
      const extractedPaths = new Set<string>();
      for (const entry of entries) {
        if (entry.isDirectory || entry === manifestEntry) continue;
        const relPath = mediaRelativePath(entry.entryName);
        if (relPath) {
          const destPath = resolveArchiveDestination(newProjectDiskDir, relPath);
          if (extractedPaths.has(destPath)) throw new Error(`Duplicate archive path: ${relPath}`);
          extractedPaths.add(destPath);
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.writeFileSync(destPath, entry.getData());
      }
    }

    // Helper: remap old file paths to new project directory
    const remapFilePath = (oldPath?: string | null): string | null => {
      if (!oldPath) return null;
      const normalized = oldPath.replace(/\\/g, '/');
      if (oldProjectId && normalized.includes(oldProjectId)) {
        return normalized.replace(oldProjectId, newProjectId);
      }
      if (!normalized.startsWith('projects/')) {
        return `projects/${newProjectId}/${normalized.replace(/^media\//, '')}`;
      }
      return normalized;
    };

    // 4. In a clean transaction, recreate all child records with remapped IDs & paths
      await prisma.$transaction(async (tx) => {
      // Recreate StyleBible
      if (manifest.styleBible) {
        await tx.styleBible.create({
          data: {
            projectId: newProjectId,
            masterStylePrompt: manifest.styleBible.masterStylePrompt || '',
            characterStyle: manifest.styleBible.characterStyle || '',
            lightingStyle: manifest.styleBible.lightingStyle || '',
            renderStyle: manifest.styleBible.renderStyle || '',
            environmentStyle: manifest.styleBible.environmentStyle || '',
            colorLanguage: manifest.styleBible.colorLanguage || '',
            cameraStyle: manifest.styleBible.cameraStyle || '',
            lensStyle: manifest.styleBible.lensStyle || '',
            depthOfFieldStyle: manifest.styleBible.depthOfFieldStyle || '',
            animationStyle: manifest.styleBible.animationStyle || '',
            materialStyle: manifest.styleBible.materialStyle || '',
            negativePrompt: manifest.styleBible.negativePrompt || '',
            aspectRatio: manifest.styleBible.aspectRatio || manifest.project.aspectRatio || '16:9',
            fps: manifest.styleBible.fps || manifest.project.fps || 24,
            isLocked: manifest.styleBible.isLocked || false,
            lockedAt: manifest.styleBible.lockedAt ? new Date(manifest.styleBible.lockedAt) : null,
          },
        });
      }

      // Map Characters: oldCharId -> newCharId
      const charIdMap: Record<string, string> = {};
      if (Array.isArray(manifest.characters)) {
        for (const char of manifest.characters) {
          const createdChar = await tx.character.create({
            data: {
              projectId: newProjectId,
              name: char.name,
              role: char.role || 'PROTAGONIST',
              gender: char.gender,
              ageDescription: char.ageDescription || '',
              faceDescription: char.faceDescription || '',
              skinDescription: char.skinDescription || '',
              eyeDescription: char.eyeDescription || '',
              hairDescription: char.hairDescription || '',
              facialHairDescription: char.facialHairDescription,
              bodyDescription: char.bodyDescription || '',
              heightDescription: char.heightDescription,
              clothingDescription: char.clothingDescription || '',
              footwearDescription: char.footwearDescription,
              accessories: char.accessories,
              personality: char.personality,
              defaultExpressions: char.defaultExpressions,
              consistencyPrompt: char.consistencyPrompt || '',
              negativeConsistencyPrompt: char.negativeConsistencyPrompt || '',
              isLocked: char.isLocked || false,
              lockedAt: char.lockedAt ? new Date(char.lockedAt) : null,
              voiceProvider: char.voiceProvider,
              voiceId: char.voiceId,
              voiceSettings: char.voiceSettings
                ? typeof char.voiceSettings === 'string'
                  ? char.voiceSettings
                  : JSON.stringify(char.voiceSettings)
                : null,
            },
          });

          charIdMap[char.id] = createdChar.id;

          // Recreate CharacterReferences
          if (Array.isArray(char.references)) {
            for (const ref of char.references) {
              await tx.characterReference.create({
                data: {
                  characterId: createdChar.id,
                  referenceType: ref.referenceType || 'PRIMARY_FACE',
                  filePath: remapFilePath(ref.filePath) || '',
                  thumbnailPath: remapFilePath(ref.thumbnailPath),
                  promptUsed: ref.promptUsed,
                  isApproved: ref.isApproved ?? true,
                  isActive: ref.isActive ?? true,
                },
              });
            }
          }
        }
      }

      // Map Scenes & Shots: oldSceneId -> newSceneId, oldShotId -> newShotId
      const sceneIdMap: Record<string, string> = {};
      const shotIdMap: Record<string, string> = {};

      if (Array.isArray(manifest.scenes)) {
        for (const scene of manifest.scenes) {
          const remappedSpeakerId = scene.speakingCharacterId
            ? charIdMap[scene.speakingCharacterId] || null
            : null;

          const createdScene = await tx.scene.create({
            data: {
              projectId: newProjectId,
              sceneNumber: scene.sceneNumber,
              title: scene.title,
              importance: scene.importance || 'NORMAL',
              status: scene.status || 'NOT_STARTED',
              location: scene.location || '',
              timeOfDay: scene.timeOfDay || '',
              environment: scene.environment || '',
              lighting: scene.lighting || '',
              mood: scene.mood || '',
              summary: scene.summary || '',
              narrationHindi: scene.narrationHindi,
              dialogueHindi: scene.dialogueHindi,
              speakingCharacterId: remappedSpeakerId,
              shotType: scene.shotType,
              cameraAngle: scene.cameraAngle,
              cameraMovement: scene.cameraMovement,
              motionPreset: scene.motionPreset,
              durationSeconds: scene.durationSeconds || 4.0,
              ambiencePrompt: scene.ambiencePrompt,
              sfxPrompt: scene.sfxPrompt,
              musicMood: scene.musicMood,
              orderIndex: scene.orderIndex ?? scene.sceneNumber,
            },
          });

          sceneIdMap[scene.id] = createdScene.id;

          // Link scene characters
          if (Array.isArray(scene.characters)) {
            for (const sc of scene.characters) {
              const oldCId = sc.characterId || sc;
              const mappedCId = charIdMap[oldCId];
              if (mappedCId) {
                await tx.sceneCharacter.create({
                  data: {
                    sceneId: createdScene.id,
                    characterId: mappedCId,
                  },
                });
              }
            }
          }

          // Recreate shots
          if (Array.isArray(scene.shots) && scene.shots.length > 0) {
            for (const shot of scene.shots) {
              const createdShot = await tx.shot.create({
                data: {
                  sceneId: createdScene.id,
                  shotNumber: shot.shotNumber,
                  description: shot.description || '',
                  duration: shot.duration || 4.0,
                },
              });
              shotIdMap[shot.id] = createdShot.id;
            }
          } else {
            const createdShot = await tx.shot.create({
              data: {
                sceneId: createdScene.id,
                shotNumber: 1,
                description: scene.summary || '',
                duration: scene.durationSeconds || 4.0,
              },
            });
            shotIdMap[`default_${scene.id}`] = createdShot.id;
          }
        }
      }

      // Recreate AssetVersions
      const allAssets = manifest.allAssetVersions || [];
      if (Array.isArray(allAssets)) {
        for (const asset of allAssets) {
          const mappedSceneId = asset.sceneId ? sceneIdMap[asset.sceneId] || null : null;
          const mappedShotId = asset.shotId ? shotIdMap[asset.shotId] || null : null;
          const mappedCharId = asset.characterId ? charIdMap[asset.characterId] || null : null;

          await tx.assetVersion.create({
            data: {
              projectId: newProjectId,
              sceneId: mappedSceneId,
              shotId: mappedShotId,
              characterId: mappedCharId,
              assetType: asset.assetType,
              provider: asset.provider || 'MANUAL',
              modelId: asset.modelId || 'IMPORTED',
              channel: asset.channel || 'MANUAL_IMPORT',
              filePath: remapFilePath(asset.filePath) || '',
              mimeType: asset.mimeType || 'image/png',
              width: asset.width,
              height: asset.height,
              duration: asset.duration,
              prompt: asset.prompt || '',
              negativePrompt: asset.negativePrompt,
              motionPrompt: asset.motionPrompt,
              settings: typeof asset.settings === 'string' ? asset.settings : JSON.stringify(asset.settings || {}),
              approvalStatus: asset.approvalStatus || 'APPROVED',
              isActive: asset.isActive ?? true,
            },
          });
        }
      }

      // Recreate PronunciationRules
      if (Array.isArray(manifest.pronunciations)) {
        for (const rule of manifest.pronunciations) {
          await tx.pronunciationRule.create({
            data: {
              projectId: newProjectId,
              writtenText: rule.writtenText,
              sarvamOverride: rule.sarvamOverride,
              elevenLabsOverride: rule.elevenLabsOverride,
              notes: rule.notes,
            },
          });
        }
      }
      });

      // 5. Save refreshed project.json manifest in new storage directory
      await saveProjectManifest(newProjectId, manifest);
    } catch (error) {
      await prisma.project.delete({ where: { id: newProjectId } }).catch(() => undefined);
      const resolvedProjectDir = path.resolve(newProjectDiskDir);
      const projectsRoot = path.resolve(path.dirname(newProjectDiskDir));
      if (resolvedProjectDir.startsWith(`${projectsRoot}${path.sep}`)) {
        await fs.promises.rm(resolvedProjectDir, { recursive: true, force: true }).catch(() => undefined);
      }
      throw error;
    }

    return {
      projectId: newProjectId,
      name: createdProject.name,
    };
  }
}
