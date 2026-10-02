import prisma from '@/lib/db/prisma';
import {
  ensureProjectStorage,
  saveProjectManifest,
} from '@/lib/storage/project-storage';
import {
  StoryFlowProjectInput,
  validateStoryFlowJson,
} from '@/schemas/storyflow.schema';

export class ProjectService {
  /**
   * Imports a validated StoryFlow project JSON into SQLite database and sets up storage.
   */
  static async importProject(data: StoryFlowProjectInput) {
    const { project, styleBible, characters, scenes } = data;

    // 1. Create or update Project record in SQLite transaction
    const createdProject = await prisma.$transaction(async (tx) => {
      // Create project
      const p = await tx.project.create({
        data: {
          name: project.name,
          description: project.description,
          aspectRatio: project.aspectRatio || '16:9',
          fps: project.fps || 24,
          targetLanguage: project.targetLanguage || 'hi-IN',
          schemaVersion: data.schemaVersion,
          budgetLimit: project.budgetLimit,
          currentPhase: 'CHARACTER_BIBLE',
        },
      });

      // Create StyleBible
      await tx.styleBible.create({
        data: {
          projectId: p.id,
          masterStylePrompt: styleBible.masterStylePrompt,
          characterStyle: styleBible.characterStyle,
          lightingStyle: styleBible.lightingStyle,
          renderStyle: styleBible.renderStyle,
          environmentStyle: styleBible.environmentStyle,
          colorLanguage: styleBible.colorLanguage,
          cameraStyle: styleBible.cameraStyle,
          lensStyle: styleBible.lensStyle,
          depthOfFieldStyle: styleBible.depthOfFieldStyle,
          animationStyle: styleBible.animationStyle,
          materialStyle: styleBible.materialStyle,
          negativePrompt: styleBible.negativePrompt,
          aspectRatio: styleBible.aspectRatio,
          fps: styleBible.fps,
          isLocked: styleBible.isLocked,
          lockedAt: styleBible.isLocked ? new Date() : null,
        },
      });

      // Create Characters & References
      for (const char of characters) {
        const createdChar = await tx.character.create({
          data: {
            id: char.id, // preserve imported character id
            projectId: p.id,
            name: char.name,
            role: char.role,
            gender: char.gender,
            ageDescription: char.ageDescription,
            faceDescription: char.faceDescription,
            skinDescription: char.skinDescription,
            eyeDescription: char.eyeDescription,
            hairDescription: char.hairDescription,
            facialHairDescription: char.facialHairDescription,
            bodyDescription: char.bodyDescription,
            heightDescription: char.heightDescription,
            clothingDescription: char.clothingDescription,
            footwearDescription: char.footwearDescription,
            accessories: char.accessories,
            personality: char.personality,
            defaultExpressions: char.defaultExpressions,
            consistencyPrompt: char.consistencyPrompt,
            negativeConsistencyPrompt: char.negativeConsistencyPrompt,
            isLocked: char.isLocked,
            lockedAt: char.isLocked ? new Date() : null,
            voiceProvider: char.voiceProvider,
            voiceId: char.voiceId,
            voiceSettings: char.voiceSettings ? JSON.stringify(char.voiceSettings) : null,
          },
        });

        if (char.referenceAssets && char.referenceAssets.length > 0) {
          for (const ref of char.referenceAssets) {
            await tx.characterReference.create({
              data: {
                characterId: createdChar.id,
                referenceType: ref.referenceType,
                filePath: ref.filePath,
                thumbnailPath: ref.thumbnailPath,
                promptUsed: ref.promptUsed,
                isApproved: ref.isApproved,
                isActive: ref.isActive,
              },
            });
          }
        }
      }

      // Create Scenes & Shots & Character Relations
      for (const scene of scenes) {
        const createdScene = await tx.scene.create({
          data: {
            projectId: p.id,
            sceneNumber: scene.sceneNumber,
            title: scene.title,
            importance: scene.importance,
            status: scene.status,
            location: scene.location,
            timeOfDay: scene.timeOfDay,
            environment: scene.environment,
            lighting: scene.lighting,
            mood: scene.mood,
            summary: scene.summary,
            narrationHindi: scene.narrationHindi,
            dialogueHindi: scene.dialogueHindi,
            speakingCharacterId: scene.speakingCharacterId,
            shotType: scene.shotType,
            cameraAngle: scene.cameraAngle,
            cameraMovement: scene.cameraMovement,
            motionPreset: scene.motionPreset,
            durationSeconds: scene.durationSeconds,
            ambiencePrompt: scene.ambiencePrompt,
            sfxPrompt: scene.sfxPrompt,
            musicMood: scene.musicMood,
            orderIndex: scene.orderIndex,
          },
        });

        // Link characters in scene
        for (const charId of scene.characterIds) {
          await tx.sceneCharacter.create({
            data: {
              sceneId: createdScene.id,
              characterId: charId,
            },
          });
        }

        // Create shots
        if (scene.shots && scene.shots.length > 0) {
          for (const shot of scene.shots) {
            await tx.shot.create({
              data: {
                sceneId: createdScene.id,
                shotNumber: shot.shotNumber,
                description: shot.description,
                duration: shot.duration,
              },
            });
          }
        } else {
          // Create default shot for the scene
          await tx.shot.create({
            data: {
              sceneId: createdScene.id,
              shotNumber: 1,
              description: scene.summary,
              duration: scene.durationSeconds,
            },
          });
        }
      }

      return p;
    });

    // 2. Ensure local disk storage structure exists
    ensureProjectStorage(createdProject.id);

    // 3. Write project.json manifest snapshot to disk
    await saveProjectManifest(createdProject.id, data);

    return createdProject;
  }

  /**
   * Retrieves a full project with all relations.
   */
  static async getProject(projectId: string) {
    return prisma.project.findUnique({
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
            characters: {
              include: {
                character: true,
              },
            },
            shots: true,
            assetVersions: true,
          },
        },
        generationJobs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
  }

  /**
   * Lists all local projects.
   */
  static async listProjects() {
    return prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        styleBible: true,
        _count: {
          select: {
            characters: true,
            scenes: true,
            assetVersions: true,
          },
        },
      },
    });
  }

  /**
   * Locks or unlocks the style bible.
   */
  static async toggleStyleLock(projectId: string, isLocked: boolean) {
    return prisma.styleBible.update({
      where: { projectId },
      data: {
        isLocked,
        lockedAt: isLocked ? new Date() : null,
      },
    });
  }

  /**
   * Locks or unlocks a character identity.
   */
  static async toggleCharacterLock(characterId: string, isLocked: boolean) {
    return prisma.character.update({
      where: { id: characterId },
      data: {
        isLocked,
        lockedAt: isLocked ? new Date() : null,
      },
    });
  }
}
