'use client'

import { useEffect, useState } from 'react'
import { FeatureImportanceChart } from '@/components/charts/feature-importance-chart'
import { DegradationCurve } from '@/components/charts/degradation-curve'
import { Cpu, GitBranch, Layers, RefreshCw, Activity, Clock, Database, Target } from 'lucide-react'
import type { TireModel } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  models: TireModel[]
}

export function ModelOps({ models }: Props) {
  const [featureImportance, setFeatureImportance] = useState<any[]>([])
  const [trainingHistory, setTrainingHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [retraining, setRetraining] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/ml-model/feature-importance').then(r => r.json()).catch(() => []),
      fetch('/api/ml-model/training-history').then(r => r.json()).catch(() => ({ history: [] })),
    ]).then(([fi, th]) => {
      // API returns a plain array for feature-importance, { history: [] } for training-history
      const features = Array.isArray(fi) ? fi : (fi.features || [])
      setFeatureImportance(features)
      setTrainingHistory(Array.isArray(th) ? th : (th.history || []))
      setLoading(false)
    })
  }, [])

  const activeModel = models.find(m => m.status === 'active') || models[0]

  const accuracySeries = [{
    id: 'accuracy',
    name: 'Accuracy',
    color: '#22c55e',
    points: models.slice().reverse().map((m, i) => ({ x: i + 1, y: m.accuracy })),
  }, {
    id: 'f1',
    name: 'F1 Score',
    color: '#06b6d4',
    points: models.slice().reverse().map((m, i) => ({ x: i + 1, y: m.f1Score })),
  }]

  const handleRetrain = () => {
    setRetraining(true)
    setTimeout(() => setRetraining(false), 2500)
  }

  return (
    <div className="space-y-4">
      {/* Model header */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-500/15 border border-green-500/30">
              <Cpu className="h-7 w-7 text-green-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-mono font-bold">{activeModel?.version}</h2>
                <span className="rounded bg-green-500/15 px-2 py-0.5 text-[10px] font-mono font-bold text-green-400">● ACTIVE</span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">
                Tire Degradation Multi-Class Classifier · Trained {new Date(activeModel?.trainedAt || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
          <button
            onClick={handleRetrain}
            disabled={retraining}
            className={cn(
              'rounded-lg px-4 py-2 text-[11px] font-mono font-bold border transition-colors flex items-center gap-2',
              retraining
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-background/60 border-white/10 hover:bg-background/80 text-foreground'
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', retraining && 'animate-spin')} />
            {retraining ? 'RETRAINING…' : 'TRIGGER WEEKLY RETRAIN'}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <ModelStat label="Accuracy" value={`${(activeModel?.accuracy * 100).toFixed(1)}%`} icon={Target} color="green" />
          <ModelStat label="Precision" value={`${(activeModel?.precision * 100).toFixed(1)}%`} icon={Target} color="cyan" />
          <ModelStat label="Recall" value={`${(activeModel?.recall * 100).toFixed(1)}%`} icon={Target} color="amber" />
          <ModelStat label="F1 Score" value={`${(activeModel?.f1Score * 100).toFixed(1)}%`} icon={Activity} color="green" />
          <ModelStat label="Avg Latency" value={`${activeModel?.avgLatencyMs.toFixed(0)}ms`} icon={Clock} color="cyan" />
          <ModelStat label="Train Samples" value={activeModel?.trainingSamples.toLocaleString() || '0'} icon={Database} color="default" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Feature importance */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-red-400" />
            FEATURE IMPORTANCE (SHAP)
          </h3>
          {loading ? (
            <div className="h-[320px] flex items-center justify-center text-xs text-muted-foreground font-mono animate-pulse">Loading model explainability…</div>
          ) : (
            <FeatureImportanceChart data={featureImportance} width={560} height={340} />
          )}
          <p className="mt-2 text-[10px] font-mono text-muted-foreground">
            <span className="text-red-400">●</span> Positive degradation impact · <span className="text-green-400">●</span> stabilizing influence
          </p>
        </div>

        {/* Accuracy trend across versions */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-cyan-400" />
            MODEL VERSION HISTORY
          </h3>
          <DegradationCurve
            series={accuracySeries}
            xLabel="Version (chronological)"
            yLabel="Score"
            yDomain={[0.78, 0.92]}
            width={560}
            height={300}
            thresholds={[{ value: 0.85, label: '>85% Target', color: '#22c55e' }]}
          />
        </div>
      </div>

      {/* Threshold definitions + features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-amber-400" />
            MULTI-CLASS THRESHOLDS
          </h3>
          <p className="text-[10px] font-mono text-muted-foreground mb-3">Classifies tire performance state into 5 bins</p>
          <div className="space-y-2">
            {[
              { label: 'Optimal', range: '≥ 95%', color: '#22c55e', action: 'Continue stint — peak grip window' },
              { label: '95% Threshold', range: '90–95%', color: '#a3e635', action: 'Monitor — approaching pit window' },
              { label: '90% Threshold', range: '85–90%', color: '#f59e0b', action: 'PREPARE PIT — trigger window opening' },
              { label: '85% Threshold', range: '80–85%', color: '#f97316', action: 'PIT NOW — performance dropping rapidly' },
              { label: 'Critical', range: '< 80%', color: '#ef4444', action: 'PIT IMMEDIATELY — severe degradation' },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-3 rounded-lg bg-background/30 p-2.5">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: t.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold" style={{ color: t.color }}>{t.label}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{t.range}</span>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground truncate">{t.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-cyan-400" />
            MODEL FEATURES (17 inputs)
          </h3>
          <p className="text-[10px] font-mono text-muted-foreground mb-3">Telemetry features fed to the classifier at inference time</p>
          <div className="grid grid-cols-2 gap-1.5">
            {activeModel && JSON.parse(activeModel.features).map((f: string, i: number) => (
              <div key={f} className="flex items-center gap-1.5 rounded bg-background/30 px-2 py-1.5 text-[10px] font-mono">
                <span className="text-muted-500 w-4">{i + 1}.</span>
                <span className="font-mono">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Version history table */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-green-400" />
          RETRAINING HISTORY
        </h3>
        <div className="overflow-x-auto rb-scroll">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-white/10">
                <th className="pb-2 pr-3">VERSION</th>
                <th className="pb-2 pr-3">STATUS</th>
                <th className="pb-2 pr-3">TRAINED</th>
                <th className="pb-2 pr-3">ACCURACY</th>
                <th className="pb-2 pr-3">F1</th>
                <th className="pb-2 pr-3">LATENCY</th>
                <th className="pb-2 pr-3">SAMPLES</th>
                <th className="pb-2 pr-3">PREDICTIONS</th>
                <th className="pb-2">DELTA</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m, i) => {
                const prev = models[i + 1]
                const delta = prev ? (m.accuracy - prev.accuracy) * 100 : 0
                return (
                  <tr key={m.id} className="border-b border-white/5 hover:bg-background/20">
                    <td className="py-1.5 pr-3 font-bold">{m.version}</td>
                    <td className="py-1.5 pr-3">
                      <span className={cn(
                        'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                        m.status === 'active' ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-muted-foreground'
                      )}>{m.status}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{new Date(m.trainedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                    <td className="py-1.5 pr-3 text-green-400 font-bold">{(m.accuracy * 100).toFixed(1)}%</td>
                    <td className="py-1.5 pr-3">{(m.f1Score * 100).toFixed(1)}%</td>
                    <td className="py-1.5 pr-3 text-cyan-400">{m.avgLatencyMs.toFixed(0)}ms</td>
                    <td className="py-1.5 pr-3">{m.trainingSamples.toLocaleString()}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{m._count?.predictions || 0}</td>
                    <td className={cn('py-1.5 font-bold', delta >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ModelStat({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  const colorMap: Record<string, string> = { green: 'text-green-400', cyan: 'text-cyan-400', amber: 'text-amber-400', default: 'text-foreground' }
  return (
    <div className="rounded-lg bg-background/40 p-3">
      <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
        <Icon className="h-3 w-3" />{label}
      </div>
      <div className={cn('font-mono text-lg font-bold', colorMap[color])}>{value}</div>
    </div>
  )
}
