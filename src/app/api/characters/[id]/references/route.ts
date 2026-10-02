import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const references = await prisma.characterReference.findMany({
      where: { characterId: params.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, references });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body = await req.json();
    const { referenceType, filePath, promptUsed, isApproved = false } = body;

    const ref = await prisma.characterReference.create({
      data: {
        characterId: params.id,
        referenceType,
        filePath,
        promptUsed,
        isApproved,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, reference: ref });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const body = await req.json();
    const { referenceId, isApproved, isActive } = body;

    const ownedReference = await prisma.characterReference.findFirst({
      where: { id: referenceId, characterId: params.id },
    });
    if (!ownedReference) {
      return NextResponse.json({ success: false, error: 'Reference not found for this character' }, { status: 404 });
    }
    const updated = await prisma.characterReference.update({
      where: { id: ownedReference.id },
      data: {
        isApproved: isApproved !== undefined ? isApproved : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return NextResponse.json({ success: true, reference: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
