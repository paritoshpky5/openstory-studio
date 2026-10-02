import { NextRequest, NextResponse } from 'next/server';
import { PronunciationDictionary } from '@/lib/audio/pronunciation-dict';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const rules = PronunciationDictionary.loadProjectDictionary(params.id);
    return NextResponse.json({
      success: true,
      rules,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body = await request.json();
    const rules = body.rules || {};
    PronunciationDictionary.saveProjectDictionary(params.id, rules);
    return NextResponse.json({
      success: true,
      rules,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
