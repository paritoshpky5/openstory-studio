import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
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
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    // 1. Locate and parse project.json
    const manifestEntry = entries.find(
      (e) => e.entryName === 'project.json' || e.entryName.endsWith('/project.json')
    );

    if (!manifestEntry) {
      throw new Error('Invalid OpenStory project archive: project.json manifest not found inside ZIP.');
    }

    let manifest: any;
    try {
      manifest = JSON.parse(manifestEntry.getData().toString('utf-8'));
    } catch (err: any) {
      throw new Error(`Failed to parse project.json manifest: ${err.message}`);
    }

    if (!manifest.project || !manifest.project.name) {
      throw new Error('Invalid project manifest: missing required project metadata.');
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
      },
    });

    const newProjectId = createdProject.id;
    const newProjectDiskDir = ensureProjectStorage(newProjectId);

    // 3. Extract media files into data/projects/{newProjectId}/
    for (const entry of entries) {
      if (entry.isDirectory || entry.entryName.endsWith('project.json')) {
        continue;
      }

      let relPath = entry.entryName.replace(/\\/g, '/');

      // Strip potential root archive folders or media/ prefix
      const mediaIdx = relPath.indexOf('media/');
      if (mediaIdx !== -1) {
        relPath = relPath.substring(mediaIdx + 'media/'.length);
      }

      // Check if path starts with one of our recognized subdirectories
      const matchesSubdir = PROJECT_SUBDIRECTORIES.some((sub) =>
        relPath.startsWith(`${sub}/`)
      );

      if (matchesSubdir) {
        const destPath = path.join(newProjectDiskDir, relPath);
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
      let normalized = oldPath.replace(/\\/g, '/');
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

    return {
      projectId: newProjectId,
      name: createdProject.name,
    };
  }
}
