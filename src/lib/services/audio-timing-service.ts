import prisma from '@/lib/db/prisma';

const TARGET_SHOT_SECONDS = 6;
const AUDIO_TAIL_SECONDS = 0.35;

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

function visualBeat(scene: any, index: number, count: number) {
  if (count === 1) return scene.summary;
  if (index === 0) return `Opening action beat: ${scene.summary}`;
  if (index === count - 1) return `Closing reaction or visual resolution beat for: ${scene.summary}`;
  return `Continuation beat ${index + 1}: a distinct reaction, action detail, or environmental cutaway that advances ${scene.summary}`;
}

export async function syncSceneTimingToSpeech(sceneId: string, speechDuration: number) {
  if (!Number.isFinite(speechDuration) || speechDuration <= 0) return null;

  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    include: { shots: { orderBy: { shotNumber: 'asc' } } },
  });
  if (!scene) return null;

  const targetDuration = rounded(Math.max(2, speechDuration + AUDIO_TAIL_SECONDS));
  const desiredCount = Math.max(1, Math.ceil(targetDuration / TARGET_SHOT_SECONDS));
  const shotDuration = rounded(targetDuration / desiredCount);

  await prisma.$transaction(async (tx) => {
    await tx.scene.update({
      where: { id: sceneId },
      data: { durationSeconds: targetDuration },
    });

    if (desiredCount > 1) {
      await tx.project.update({
        where: { id: scene.projectId },
        data: { shotPlanningMode: 'MULTI_SHOT' },
      });
    }

    for (let index = 0; index < desiredCount; index += 1) {
      const existing = scene.shots[index];
      const duration = index === desiredCount - 1
        ? rounded(targetDuration - (shotDuration * index))
        : shotDuration;
      const description = visualBeat(scene, index, desiredCount);
      if (existing) {
        await tx.shot.update({
          where: { id: existing.id },
          data: { shotNumber: index + 1, duration, description },
        });
      } else {
        await tx.shot.create({
          data: { sceneId, shotNumber: index + 1, duration, description },
        });
      }
    }
  });

  return { sceneId, speechDuration, targetDuration, shotCount: desiredCount };
}

export async function syncProjectTimingToSpeech(projectId: string) {
  const scenes = await prisma.scene.findMany({
    where: { projectId },
    orderBy: { sceneNumber: 'asc' },
    include: {
      assetVersions: {
        where: { isActive: true, assetType: { in: ['NARRATION', 'DIALOGUE'] } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  const results = [];
  for (const scene of scenes) {
    const speech = scene.assetVersions[0];
    if (!speech?.duration) continue;
    const result = await syncSceneTimingToSpeech(scene.id, speech.duration);
    if (result) results.push({ sceneNumber: scene.sceneNumber, ...result });
  }
  return results;
}
