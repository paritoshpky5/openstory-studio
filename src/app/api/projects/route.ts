import { NextRequest, NextResponse } from 'next/server';
import { ProjectService } from '@/lib/services/project-service';
import { validateStoryFlowJson } from '@/schemas/storyflow.schema';

export async function GET() {
  try {
    const projects = await ProjectService.listProjects();
    return NextResponse.json({ success: true, projects });
  } catch (error: any) {
    console.error('Failed to list projects:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list projects' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let rawData = body;
    // If passed as a raw string (e.g. from copy/paste textarea)
    if (typeof body.rawJson === 'string') {
      try {
        rawData = JSON.parse(body.rawJson);
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid JSON format: could not parse string into JSON',
            details: [err.message],
          },
          { status: 400 }
        );
      }
    } else if (body.projectJson) {
      rawData = body.projectJson;
    }

    // Rigorous Zod validation
    const validation = validateStoryFlowJson(rawData);
    if (!validation.success || !validation.data) {
      return NextResponse.json(
        {
          success: false,
          error: 'OpenStory schema validation failed',
          details: validation.errors,
        },
        { status: 422 }
      );
    }

    // Persist to DB and disk
    const createdProject = await ProjectService.importProject(validation.data);

    return NextResponse.json({
      success: true,
      project: createdProject,
      message: 'Project successfully imported with characters, scenes, and style bible.',
    });
  } catch (error: any) {
    console.error('Error importing project:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error importing project' },
      { status: 500 }
    );
  }
}
