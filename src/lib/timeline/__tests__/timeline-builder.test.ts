import { describe, it, expect } from 'vitest';
import { buildDefaultTimeline, ProjectTimelineInput } from '../timeline-builder';

describe('Deterministic Timeline Builder', () => {
  it('generates multi-track timeline from project scenes and assets with proper alignment', () => {
    const mockProject: ProjectTimelineInput = {
      id: 'proj_test_builder',
      name: 'The Brave Tiger',
      aspectRatio: '16:9',
      fps: 24,
      scenes: [
        {
          id: 'scene_1',
          sceneNumber: 1,
          title: 'Forest Dawn',
          durationSeconds: 4.0,
          narrationHindi: 'एक समय की बात है।',
          summary: 'A quiet morning in the forest',
          shots: [{ id: 'shot_1', shotNumber: 1 }],
          assetVersions: [
            {
              id: 'vid_1',
              assetType: 'VIDEO',
              filePath: 'projects/proj_test_builder/video/scene1.mp4',
              duration: 4.0,
              isActive: true,
              approvalStatus: 'APPROVED',
            },
            {
              id: 'narr_1',
              assetType: 'NARRATION',
              filePath: 'projects/proj_test_builder/audio/scene1_narr.wav',
              duration: 3.5,
              isActive: true,
            },
            {
              id: 'amb_1',
              assetType: 'AMBIENCE',
              filePath: 'projects/proj_test_builder/audio/scene1_amb.wav',
              duration: 4.0,
              isActive: true,
            },
          ],
        },
        {
          id: 'scene_2',
          sceneNumber: 2,
          title: 'River Crossing',
          durationSeconds: 5.0,
          dialogueHindi: 'रुको! वहां खतरा है।',
          summary: 'The tiger pauses by the water',
          shots: [{ id: 'shot_2', shotNumber: 1 }],
          assetVersions: [
            {
              id: 'lip_2',
              assetType: 'LIPSYNC',
              filePath: 'projects/proj_test_builder/video/scene2_lip.mp4',
              duration: 5.0,
              isActive: true,
              approvalStatus: 'APPROVED',
            },
            {
              id: 'diag_2',
              assetType: 'DIALOGUE',
              filePath: 'projects/proj_test_builder/audio/scene2_diag.wav',
              duration: 2.8,
              isActive: true,
            },
            {
              id: 'sfx_2',
              assetType: 'SFX',
              filePath: 'projects/proj_test_builder/audio/scene2_splash.wav',
              duration: 1.5,
              isActive: true,
            },
          ],
        },
      ],
      assetVersions: [
        {
          id: 'music_1',
          assetType: 'MUSIC',
          filePath: 'projects/proj_test_builder/music/master_music.wav',
          duration: 9.0,
          isActive: true,
        },
      ],
    };

    const timeline = buildDefaultTimeline(mockProject);

    expect(timeline.projectId).toBe('proj_test_builder');
    expect(timeline.fps).toBe(24);
    expect(timeline.aspectRatio).toBe('16:9');
    expect(timeline.width).toBe(1920);
    expect(timeline.height).toBe(1080);
    expect(timeline.tracks).toHaveLength(7);

    // Video Track
    const videoTrack = timeline.tracks.find((t) => t.type === 'VIDEO')!;
    expect(videoTrack.clips).toHaveLength(2);
    expect(videoTrack.clips[0].startTime).toBe(0);
    expect(videoTrack.clips[0].duration).toBe(4.0);
    expect(videoTrack.clips[0].sourceFilePath).toBe('projects/proj_test_builder/video/scene1.mp4');

    expect(videoTrack.clips[1].startTime).toBe(4.0);
    expect(videoTrack.clips[1].duration).toBe(5.0);
    expect(videoTrack.clips[1].assetType).toBe('LIPSYNC'); // LIPSYNC preferred over VIDEO

    // Narration Track
    const narrTrack = timeline.tracks.find((t) => t.type === 'NARRATION')!;
    expect(narrTrack.clips).toHaveLength(1);
    expect(narrTrack.clips[0].startTime).toBe(0); // Aligned to scene 1

    // Dialogue Track
    const diagTrack = timeline.tracks.find((t) => t.type === 'DIALOGUE')!;
    expect(diagTrack.clips).toHaveLength(1);
    expect(diagTrack.clips[0].startTime).toBe(4.0); // Aligned to scene 2 start!

    // Ambience Track
    const ambTrack = timeline.tracks.find((t) => t.type === 'AMBIENCE')!;
    expect(ambTrack.clips).toHaveLength(1);
    expect(ambTrack.clips[0].startTime).toBe(0);

    // SFX Track
    const sfxTrack = timeline.tracks.find((t) => t.type === 'SFX')!;
    expect(sfxTrack.clips).toHaveLength(1);
    expect(sfxTrack.clips[0].startTime).toBe(4.0);

    // Music Track
    const musicTrack = timeline.tracks.find((t) => t.type === 'MUSIC')!;
    expect(musicTrack.clips).toHaveLength(1);
    expect(musicTrack.clips[0].startTime).toBe(0);
    expect(musicTrack.clips[0].duration).toBe(9.0);

    // Subtitle Track
    const subTrack = timeline.tracks.find((t) => t.type === 'SUBTITLE')!;
    expect(subTrack.clips).toHaveLength(2);
    expect(subTrack.clips[0].startTime).toBe(0);
    expect(subTrack.clips[0].metadata?.text).toBe('एक समय की बात है।');
    expect(subTrack.clips[1].startTime).toBe(4.0);
    expect(subTrack.clips[1].metadata?.text).toBe('रुको! वहां खतरा है।');

    // Total Duration
    expect(timeline.totalDuration).toBe(9.0);
  });

  it('handles scenes without generated assets gracefully by creating draft placeholders', () => {
    const draftProject: ProjectTimelineInput = {
      id: 'proj_draft',
      name: 'Draft Project',
      scenes: [
        {
          id: 's_draft_1',
          sceneNumber: 1,
          title: 'Opening Shot',
          durationSeconds: 3.5,
          narrationHindi: 'कथा की शुरुआत',
        },
      ],
    };

    const timeline = buildDefaultTimeline(draftProject);
    const videoTrack = timeline.tracks.find((t) => t.type === 'VIDEO')!;

    expect(videoTrack.clips).toHaveLength(1);
    expect(videoTrack.clips[0].startTime).toBe(0);
    expect(videoTrack.clips[0].duration).toBe(3.5);
    expect(videoTrack.clips[0].metadata?.isPlaceholder).toBe(true);
    const musicTrack = timeline.tracks.find((t) => t.type === 'MUSIC')!;
    expect(musicTrack.clips).toHaveLength(0);
  });
});
