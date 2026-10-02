import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const projectId = params.id;
    const { searchParams } = new URL(request.url);

    const sceneId = searchParams.get('sceneId');
    const assetType = searchParams.get('assetType');
    const approvalStatus = searchParams.get('approvalStatus');

    const where: any = { projectId };
    if (sceneId) where.sceneId = sceneId;
    if (assetType) where.assetType = assetType;
    if (approvalStatus) where.approvalStatus = approvalStatus;

    const assets = await prisma.assetVersion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        scene: {
          select: {
            id: true,
            sceneNumber: true,
            title: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      assets,
    });
  } catch (error: any) {
    console.error('Error fetching assets:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch assets' },
      { status: 500 }
    );
  }
}
