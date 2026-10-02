import prisma from '@/lib/db/prisma';

export class ProjectBoundaryError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 = 404
  ) {
    super(message);
    this.name = 'ProjectBoundaryError';
  }
}

export async function requireProject(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new ProjectBoundaryError('Project not found');
  return project;
}

export async function requireProjectScene(projectId: string, sceneId: string) {
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, projectId },
  });
  if (!scene) throw new ProjectBoundaryError('Scene not found in this project');
  return scene;
}

export async function requireProjectCharacter(projectId: string, characterId: string) {
  const character = await prisma.character.findFirst({
    where: { id: characterId, projectId },
  });
  if (!character) throw new ProjectBoundaryError('Character not found in this project');
  return character;
}

export async function requireProjectShot(projectId: string, shotId: string) {
  const shot = await prisma.shot.findFirst({
    where: { id: shotId, scene: { projectId } },
  });
  if (!shot) throw new ProjectBoundaryError('Shot not found in this project');
  return shot;
}

export async function requireProjectAsset(projectId: string, assetId: string) {
  const asset = await prisma.assetVersion.findFirst({
    where: { id: assetId, projectId },
  });
  if (!asset) throw new ProjectBoundaryError('Asset not found in this project');
  return asset;
}

export function projectBoundaryStatus(error: unknown): number {
  return error instanceof ProjectBoundaryError ? error.status : 500;
}
