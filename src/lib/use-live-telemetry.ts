'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { LiveTelemetry } from '@/lib/types'

export function useLiveTelemetry() {
  const [telemetry, setTelemetry] = useState<Record<string, LiveTelemetry>>({})
  const [connected, setConnected] = useState(false)
  const [raceStatus, setRaceStatus] = useState<{ lap: number; totalLaps: number; leader: string; fastestLap: number; fastestDriver: string } | null>(null)
  const [pitEvents, setPitEvents] = useState<any[]>([])
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    let mounted = true

    const socket = io('/socket.io', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1500,
    })
    socketRef.current = socket

    socket.on('connect', () => { if (mounted) setConnected(true) })
    socket.on('disconnect', () => { if (mounted) setConnected(false) })
    socket.on('telemetry:update', (data: LiveTelemetry) => {
      if (mounted) setTelemetry((prev) => ({ ...prev, [data.driverCode]: data }))
    })
    socket.on('telemetry:snapshot', (data: { telemetry: LiveTelemetry[] }) => {
      if (mounted && data?.telemetry) {
        const map: Record<string, LiveTelemetry> = {}
        for (const t of data.telemetry) map[t.driverCode] = t
        setTelemetry(map)
      }
    })
    socket.on('race:status', (data: any) => { if (mounted) setRaceStatus(data) })
    socket.on('pit:stop', (data: any) => {
      if (mounted) setPitEvents((prev) => [{ ...data, ts: Date.now() }, ...prev].slice(0, 20))
    })

    return () => {
      mounted = false
      socket.disconnect()
    }
  }, [])

  return { telemetry, connected, raceStatus, pitEvents }
}
