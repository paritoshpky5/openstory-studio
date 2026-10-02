import { NextRequest, NextResponse } from 'next/server';
import { ProjectService } from '@/lib/services/project-service';

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { isLocked } = await req.json();
    const updatedStyle = await ProjectService.toggleStyleLock(
      params.id,
      Boolean(isLocked)
    );
    return NextResponse.json({ success: true, styleBible: updatedStyle });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
