import { NextRequest, NextResponse } from 'next/server';
import { ProjectService } from '@/lib/services/project-service';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isLocked } = await req.json();
    const updatedChar = await ProjectService.toggleCharacterLock(
      params.id,
      Boolean(isLocked)
    );
    return NextResponse.json({ success: true, character: updatedChar });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
