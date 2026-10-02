import { NextRequest, NextResponse } from 'next/server';
import { ProjectService } from '@/lib/services/project-service';
import { PromptCompiler } from '@/lib/prompt-compiler/prompt-compiler';

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body = await req.json();
    const { sceneId, provider = 'FLUX', type = 'IMAGE' } = body;

    const project = await ProjectService.getProject(params.id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const scene = project.scenes.find((s) => s.id === sceneId);
    if (!scene) {
      return NextResponse.json({ success: false, error: 'Scene not found in project' }, { status: 404 });
    }

    // Resolve characters in this scene
    const sceneCharacters = scene.characters.map((sc) => sc.character as any);
    const activeReferences = scene.characters.flatMap((sc) =>
      sc.character.references
        .filter((ref) => ref.isActive && ref.isApproved)
        .map((ref) => ({
          characterId: sc.characterId,
          filePath: ref.filePath,
          type: ref.referenceType,
        }))
    );

    const compilerInput = {
      styleBible: project.styleBible as any,
      characters: sceneCharacters,
      scene: {
        ...scene,
        characterIds: scene.characters.map((c) => c.characterId),
      } as any,
      shot: scene.shots?.[0] as any,
      activeReferences,
    };

    if (type === 'MOTION') {
      const compiled = PromptCompiler.compileForMotion(compilerInput, provider as any);
      return NextResponse.json({ success: true, compiled });
    } else {
      const compiled = PromptCompiler.compileForImage(compilerInput, provider as any);
      return NextResponse.json({ success: true, compiled });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
