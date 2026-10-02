import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ImageWorkflowService } from '@/lib/services/image-workflow-service';
import { projectBoundaryStatus, requireProjectAsset } from '@/lib/security/project-boundary';

const actionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'SET_ACTIVE']),
  makeActive: z.boolean().default(true),
  rejectionReasons: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; assetId: string }> }
) {
  const params = await props.params;
  try {
    const { id: projectId, assetId } = params;
    await requireProjectAsset(projectId, assetId);
    const body = await request.json();
    const validated = actionSchema.parse(body);

    let updatedAsset;

    switch (validated.action) {
      case 'APPROVE':
        updatedAsset = await ImageWorkflowService.approveAssetVersion(
          assetId,
          validated.makeActive
        );
        break;

      case 'REJECT':
        updatedAsset = await ImageWorkflowService.rejectAssetVersion(
          assetId,
          validated.rejectionReasons,
          validated.notes
        );
        break;

      case 'SET_ACTIVE':
        updatedAsset = await ImageWorkflowService.setActiveAssetVersion(assetId);
        break;
    }

    return NextResponse.json({
      success: true,
      asset: updatedAsset,
    });
  } catch (error: any) {
    console.error('Error handling asset action:', error);
    return NextResponse.json(
      { error: error.message || 'Action failed' },
      { status: projectBoundaryStatus(error) }
    );
  }
}
