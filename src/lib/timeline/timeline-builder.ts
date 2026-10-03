import { TimelineComposition, TimelineTrack, TimelineClip } from '@/types/timeline';
import { calculateTotalDuration } from './timeline-math';

export interface ProjectTimelineInput {
  id: string;
  name: string;
  aspectRatio?: string | null;
  fps?: number | null;
  scenes?: Array<{
    id: string;
    sceneNumber: number;
    title: string;
    durationSeconds?: number | null;
    narrationHindi?: string | null;
    dialogueHindi?: string | null;
    summary?: string | null;
    shots?: Array<{ id: string; shotNumber: number }>;
    assetVersions?: Array<{
      id: string;
      assetType: string;
      filePath: string;
      duration?: number | null;
      isActive: boolean;
      approvalStatus?: string;
    }>;
  }>;
  assetVersions?: Array<{
    id: string;
    assetType: string;
    filePath: string;
    duration?: number | null;
    isActive: boolean;
    approvalStatus?: string;
  }>;
}

export function getResolutionFromAspectRatio(aspectRatio?: string | null): { width: number; height: number } {
  switch (aspectRatio) {
    case '9:16':
      return { width: 1080, height: 1920 };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '4:3':
      return { width: 1440, height: 1080 };
    case '21:9':
      return { width: 2560, height: 1080 };
    case '16:9':
    default:
      return { width: 1920, height: 1080 };
  }
}

/**
 * Builds a deterministic initial timeline composition from project scenes and approved assets.
 */
export function buildDefaultTimeline(project: ProjectTimelineInput): TimelineComposition {
  const fps = project.fps || 24;
  const aspectRatio = project.aspectRatio || '16:9';
  const { width, height } = getResolutionFromAspectRatio(aspectRatio);

  const scenes = [...(project.scenes || [])].sort((a, b) => a.sceneNumber - b.sceneNumber);

  const videoClips: TimelineClip[] = [];
  const narrationClips: TimelineClip[] = [];
  const dialogueClips: TimelineClip[] = [];
  const ambienceClips: TimelineClip[] = [];
  const sfxClips: TimelineClip[] = [];
  const musicClips: TimelineClip[] = [];
  const subtitleClips: TimelineClip[] = [];

  let currentTimelineSeconds = 0;

  for (const scene of scenes) {
    const sceneAssets = scene.assetVersions || [];
    const narrationAsset = sceneAssets.find(
      (a) => a.isActive && a.assetType === 'NARRATION'
    );
    const dialogueAsset = sceneAssets.find(
      (a) => a.isActive && a.assetType === 'DIALOGUE'
    );

    // A narrator is normally off-screen. Only prefer a lip-sync asset when a
    // character actually has dialogue; otherwise retain the motion shot.
    const activeVideo = dialogueAsset
      ? sceneAssets.find((a) => a.isActive && a.assetType === 'LIPSYNC') ||
        sceneAssets.find((a) => a.isActive && a.assetType === 'VIDEO') ||
        sceneAssets.find((a) => a.assetType === 'LIPSYNC' || a.assetType === 'VIDEO')
      : sceneAssets.find((a) => a.isActive && a.assetType === 'VIDEO') ||
        sceneAssets.find((a) => a.assetType === 'VIDEO') ||
        sceneAssets.find((a) => a.isActive && a.assetType === 'LIPSYNC') ||
        sceneAssets.find((a) => a.assetType === 'LIPSYNC');

    const sceneDuration = activeVideo?.duration || scene.durationSeconds || 4.0;
    const shotId = scene.shots && scene.shots.length > 0 ? scene.shots[0].id : null;

    videoClips.push({
      id: `clip_v_${scene.id}`,
      trackId: 'track_video',
      sceneId: scene.id,
      shotId,
      assetVersionId: activeVideo?.id || null,
      sourceFilePath: activeVideo?.filePath || null,
      startTime: currentTimelineSeconds,
      duration: sceneDuration,
      trimIn: 0,
      trimOut: 0,
      sourceDuration: activeVideo?.duration || sceneDuration,
      volume: 1.0,
      muted: false,
      label: `Scene ${scene.sceneNumber}: ${scene.title}`,
      assetType: activeVideo?.assetType || 'VIDEO',
      metadata: {
        sceneNumber: scene.sceneNumber,
        isPlaceholder: !activeVideo,
      },
    });

    // 2. Hindi Narration
    if (narrationAsset) {
      const audioDuration = narrationAsset.duration || sceneDuration;
      narrationClips.push({
        id: `clip_narr_${scene.id}`,
        trackId: 'track_narration',
        sceneId: scene.id,
        shotId,
        assetVersionId: narrationAsset.id,
        sourceFilePath: narrationAsset.filePath,
        startTime: currentTimelineSeconds,
        duration: audioDuration,
        trimIn: 0,
        trimOut: 0,
        sourceDuration: narrationAsset.duration || audioDuration,
        volume: 1.0,
        muted: false,
        label: `Narration: S${scene.sceneNumber}`,
        assetType: 'NARRATION',
        metadata: { text: scene.narrationHindi },
      });
    }

    // 3. Dialogue
    if (dialogueAsset) {
      const audioDuration = dialogueAsset.duration || sceneDuration;
      dialogueClips.push({
        id: `clip_diag_${scene.id}`,
        trackId: 'track_dialogue',
        sceneId: scene.id,
        shotId,
        assetVersionId: dialogueAsset.id,
        sourceFilePath: dialogueAsset.filePath,
        startTime: currentTimelineSeconds,
        duration: audioDuration,
        trimIn: 0,
        trimOut: 0,
        sourceDuration: dialogueAsset.duration || audioDuration,
        volume: 1.0,
        muted: false,
        label: `Dialogue: S${scene.sceneNumber}`,
        assetType: 'DIALOGUE',
        metadata: { text: scene.dialogueHindi },
      });
    }

    // 4. Ambience
    const ambienceAsset = sceneAssets.find(
      (a) => a.isActive && a.assetType === 'AMBIENCE'
    );
    if (ambienceAsset) {
      const audioDuration = ambienceAsset.duration || sceneDuration;
      ambienceClips.push({
        id: `clip_amb_${scene.id}`,
        trackId: 'track_ambience',
        sceneId: scene.id,
        shotId,
        assetVersionId: ambienceAsset.id,
        sourceFilePath: ambienceAsset.filePath,
        startTime: currentTimelineSeconds,
        duration: audioDuration,
        trimIn: 0,
        trimOut: 0,
        sourceDuration: ambienceAsset.duration || audioDuration,
        volume: 0.5,
        muted: false,
        label: `Ambience: S${scene.sceneNumber}`,
        assetType: 'AMBIENCE',
      });
    }

    // 5. SFX
    const sfxAsset = sceneAssets.find(
      (a) => a.isActive && a.assetType === 'SFX'
    );
    if (sfxAsset) {
      const audioDuration = sfxAsset.duration || 2.0;
      sfxClips.push({
        id: `clip_sfx_${scene.id}`,
        trackId: 'track_sfx',
        sceneId: scene.id,
        shotId,
        assetVersionId: sfxAsset.id,
        sourceFilePath: sfxAsset.filePath,
        startTime: currentTimelineSeconds,
        duration: audioDuration,
        trimIn: 0,
        trimOut: 0,
        sourceDuration: sfxAsset.duration || audioDuration,
        volume: 0.8,
        muted: false,
        label: `SFX: S${scene.sceneNumber}`,
        assetType: 'SFX',
      });
    }

    // 6. Subtitles
    const subtitleText = scene.narrationHindi || scene.dialogueHindi || scene.summary;
    if (subtitleText && subtitleText.trim()) {
      subtitleClips.push({
        id: `clip_sub_${scene.id}`,
        trackId: 'track_subtitle',
        sceneId: scene.id,
        shotId,
        assetVersionId: null,
        sourceFilePath: null,
        startTime: currentTimelineSeconds,
        duration: sceneDuration,
        trimIn: 0,
        trimOut: 0,
        sourceDuration: sceneDuration,
        volume: 1.0,
        muted: false,
        label: scene.dialogueHindi ? `[Dialogue] S${scene.sceneNumber}` : `[Narration] S${scene.sceneNumber}`,
        assetType: 'SUBTITLE',
        metadata: {
          text: subtitleText.trim(),
          speaker: scene.dialogueHindi ? 'पात्र' : undefined,
        },
      });
    }

    currentTimelineSeconds += sceneDuration;
  }

  // 7. Project Music
  const allProjectAssets = project.assetVersions || [];
  const musicAsset = allProjectAssets.find((a) => a.isActive && a.assetType === 'MUSIC');
  if (musicAsset) {
    const totalVideoLength = Math.max(currentTimelineSeconds, 4.0);
    musicClips.push({
      id: `clip_music_${project.id}`,
      trackId: 'track_music',
      sceneId: null,
      shotId: null,
      assetVersionId: musicAsset.id,
      sourceFilePath: musicAsset.filePath,
      startTime: 0,
      duration: totalVideoLength,
      trimIn: 0,
      trimOut: 0,
      sourceDuration: musicAsset.duration || totalVideoLength,
      volume: 0.35,
      muted: false,
      label: 'Soundtrack / Music Bed',
      assetType: 'MUSIC',
      metadata: { isMasterMusic: true },
    });
  }

  const tracks: TimelineTrack[] = [
    {
      id: 'track_video',
      type: 'VIDEO',
      name: 'Video (V1)',
      order: 0,
      muted: false,
      volume: 1.0,
      clips: videoClips,
    },
    {
      id: 'track_narration',
      type: 'NARRATION',
      name: 'Hindi Narration (A1)',
      order: 1,
      muted: false,
      volume: 1.0,
      clips: narrationClips,
    },
    {
      id: 'track_dialogue',
      type: 'DIALOGUE',
      name: 'Dialogue (A2)',
      order: 2,
      muted: false,
      volume: 1.0,
      clips: dialogueClips,
    },
    {
      id: 'track_ambience',
      type: 'AMBIENCE',
      name: 'Ambience (A3)',
      order: 3,
      muted: false,
      volume: 0.6,
      clips: ambienceClips,
    },
    {
      id: 'track_sfx',
      type: 'SFX',
      name: 'Sound FX (A4)',
      order: 4,
      muted: false,
      volume: 0.8,
      clips: sfxClips,
    },
    {
      id: 'track_music',
      type: 'MUSIC',
      name: 'Music Bed (A5)',
      order: 5,
      muted: false,
      volume: 0.35,
      clips: musicClips,
    },
    {
      id: 'track_subtitle',
      type: 'SUBTITLE',
      name: 'Subtitles (S1)',
      order: 6,
      muted: false,
      volume: 1.0,
      clips: subtitleClips,
    },
  ];

  const totalDuration = calculateTotalDuration(tracks, currentTimelineSeconds);

  return {
    version: 1,
    projectId: project.id,
    fps,
    aspectRatio,
    width,
    height,
    totalDuration,
    tracks,
    updatedAt: new Date().toISOString(),
  };
}
