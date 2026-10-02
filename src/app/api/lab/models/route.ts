import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET() {
  try {
    const models = await prisma.modelRegistryItem.findMany({
      orderBy: [
        { type: 'asc' },
        { approvalRate: 'desc' }
      ]
    });
    
    return NextResponse.json({ success: true, models });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
