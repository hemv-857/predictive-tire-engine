import { NextRequest, NextResponse } from 'next/server'

// Proxy to ML prediction service on port 3004
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const res = await fetch('http://localhost:3004/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
