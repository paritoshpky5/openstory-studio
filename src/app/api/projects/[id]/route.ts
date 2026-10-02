import { NextRequest, NextResponse } from 'next/server';
import { ProjectService } from '@/lib/services/project-service';
import prisma from '@/lib/db/prisma';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const project = await ProjectService.getProject(params.id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body = await req.json();
    const updated = await prisma.project.update({
      where: { id: params.id },
      data: {
        currentPhase: body.currentPhase,
        budgetLimit: body.budgetLimit !== undefined ? body.budgetLimit : undefined,
        name: body.name || undefined,
        description: body.description !== undefined ? body.description : undefined,
      },
    });
    return NextResponse.json({ success: true, project: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await prisma.project.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true, message: 'Project deleted' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
