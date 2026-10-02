import fs from 'fs';
import path from 'path';
import prisma from '@/lib/db/prisma';
import { AudioDuckingEngine, SpeechSegment } from './audio-ducking';
import { SubtitleGenerator } from '@/lib/subtitles/subtitle-generator';

export interface AudioStemConfig {
  narrationVolume: number; // default 1.0 (0dB)
  dialogueVolume: number;  // default 1.0 (0dB)
  ambienceVolume: number; // default 0.15 (-16dB)
  sfxVolume: number;      // default 0.50 (-6dB)
  musicVolume: number;    // default 0.25 (-12dB)
  enableDucking: boolean; // default true
  duckingAmount: number;  // default 0.20 (-14dB)
}

export class SoundDesignService {
  /**
   * Generates mock ambient audio or tone buffer if needed for previewing the stem
   */
  static getStemStorageDir(projectId: string, stemType: 'ambience' | 'sfx' | 'music'): string {
    const dir = path.join(process.cwd(), 'data', 'projects', projectId, stemType);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Scans project scenes to identify active speech segments across the entire timeline
   */
  static async getProjectSpeechSegments(projectId: string): Promise<SpeechSegment[]> {
    const scenes = await prisma.scene.findMany({
      where: { projectId },
      orderBy: { sceneNumber: 'asc' },
      include: {
        assetVersions: {
          where: {
            isActive: true,
            assetType: { in: ['NARRATION', 'DIALOGUE'] },
          },
        },
      },
    });

    const segments: SpeechSegment[] = [];
    let currentOffset = 0;

    for (const scene of scenes) {
      const activeVoice = scene.assetVersions[0];
      const sceneDuration = scene.durationSeconds || 4.0;
      const voiceDuration = activeVoice?.duration || (scene.narrationHindi ? sceneDuration * 0.8 : 0);

      if (voiceDuration > 0) {
        segments.push({
          startSeconds: currentOffset,
          endSeconds: currentOffset + voiceDuration,
          speakerId: scene.speakingCharacterId || 'NARRATOR',
          text: scene.narrationHindi || scene.dialogueHindi || undefined,
        });
      }

      currentOffset += sceneDuration;
    }

    return segments;
  }

  /**
   * Generates and writes project subtitles
   */
  static async generateSubtitlesForProject(projectId: string) {
    const scenes = await prisma.scene.findMany({
      where: { projectId },
      orderBy: { sceneNumber: 'asc' },
    });

    const cues = SubtitleGenerator.buildCuesFromScenes(scenes);
    const result = SubtitleGenerator.saveProjectSubtitles(projectId, cues);

    return {
      cues,
      ...result,
    };
  }
}
