import { NextRequest, NextResponse } from 'next/server'

const ENDPOINTS: Record<string, string> = {
  status: '/model/status',
  'feature-importance': '/model/feature-importance',
  'training-history': '/model/training-history',
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string }> }) {
  const { path } = await params
  const upstream = ENDPOINTS[path]
  if (!upstream) {
    return NextResponse.json({ error: 'Unknown model endpoint' }, { status: 404 })
  }
  try {
    const res = await fetch(`http://localhost:3004${upstream}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
