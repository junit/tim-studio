import React, { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Panel, Group, useGroupRef } from 'react-resizable-panels'
import {
  Play,
  Pause,
  Square,
  Download,
  Trash2,
  Terminal,
  Layers,
  FileSpreadsheet,
  Clock,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Eye,
  ShieldAlert,
  ArrowRight,
  Info,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ResizeHandle } from '@/components/ui/resize-handle'
import { Dropzone } from '@/components/common/Dropzone'
import { useBatchStore, BatchPreset } from '@/stores/batchStore'
import { useApiStore } from '@/stores/apiStore'
import { useHistoryStore } from '@/stores/historyStore'
import { HistoryPanel } from '@/components/panels/HistoryPanel'

const getPresetBadgeColor = (color: string) => {
  switch (color) {
    case 'rose':
      return 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900'
    case 'amber':
      return 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900'
    case 'blue':
      return 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900'
    case 'emerald':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900'
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  }
}

export const BatchCenter: React.FC = () => {
  const {
    apiId,
    items,
    fileName,
    delaySec,
    isDryRun,
    activeTaskId,
    isRunning,
    isPaused,
    progress,
    logs,
    presets,
    activePresetId,
    guidance,
    failedItems,
    retryFailed,
    setApiId,
    setDelaySec,
    setDryRun,
    loadTodayPreset,
    loadPresets,
    applyPreset,
    fetchGuidance,
    clearItems,
    clearLogs,
    startBatch,
    pauseBatch,
    resumeBatch,
    stopBatch,
  } = useBatchStore()

  const { apis } = useApiStore()
  const logContainerRef = useRef<HTMLDivElement>(null)
  const batchGroupRef = useGroupRef()

  // 子视图切换：批量任务执行 (runner) / 历史执行台账 (history)
  const [batchView, setBatchView] = useState<'runner' | 'history'>('runner')
  const { historyList, fetchHistory } = useHistoryStore()

  // 终端折叠与全屏状态
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState<boolean>(false)
  const [isTerminalMaximized, setIsTerminalMaximized] = useState<boolean>(false)
  const prevTerminalHeightRef = useRef<number>(42)

  // 场景预设折叠状态（默认紧凑胶囊行，节省宝贵纵向高度）
  const [isPresetsExpanded, setIsPresetsExpanded] = useState<boolean>(false)

  // 初始化拉取推荐预设与当前接口的风控建议及历史台账
  useEffect(() => {
    loadPresets()
    fetchHistory()
    if (apiId) {
      fetchGuidance(apiId)
    }
  }, [])

  // Auto scroll terminal log to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  const selectedApi = apis.find((a) => a.api_id === apiId)
  const selectedPreset = presets.find((p) => p.id === activePresetId || p.api_id === apiId)

  const handleExportCsv = (onlyFailed = false) => {
    if (!activeTaskId) return
    const url = `/api/batch/${activeTaskId}/export/csv${onlyFailed ? '?only_failed=true' : ''}`
    window.open(url, '_blank')
  }

  // 切换终端高度（最大化到 80% / 还原到 42%）
  const handleToggleTerminalHeight = () => {
    if (!batchGroupRef.current) return
    try {
      const layout = batchGroupRef.current.getLayout()
      const termSize = layout['terminal-panel'] ?? 42
      if (termSize >= 70) {
        // 当前为最大化：还原到先前记录的高度或默认 42%
        const restoreSize =
          prevTerminalHeightRef.current && prevTerminalHeightRef.current < 70
            ? prevTerminalHeightRef.current
            : 42
        batchGroupRef.current.setLayout({
          'config-panel': 100 - restoreSize,
          'terminal-panel': restoreSize,
        })
        setIsTerminalMaximized(false)
      } else {
        // 放大展开终端窗格至 80%
        prevTerminalHeightRef.current = termSize
        batchGroupRef.current.setLayout({
          'config-panel': 20,
          'terminal-panel': 80,
        })
        setIsTerminalMaximized(true)
      }
    } catch (e) {
      console.warn('Toggle terminal height error:', e)
    }
  }

  // 启动批处理任务（若控制台收起，自动弹出）
  const handleStart = () => {
    if (isTerminalCollapsed) {
      setIsTerminalCollapsed(false)
    }
    startBatch()
  }

  return (
    <div className="flex h-full flex-col bg-slate-50/60 dark:bg-slate-950 overflow-hidden">
      {/* 批量调用统一头部栏：支持「批量任务执行」与「历史执行台账」 */}
      <div className="shrink-0 px-4 sm:px-6 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3 sm:gap-4 select-none">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/80 shadow-2xs shrink-0">
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                批量调用中心
              </h2>
              <Badge
                variant="outline"
                className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 font-mono text-[9px] py-0 px-1.5 shrink-0"
              >
                Runner
              </Badge>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              全量 166 项 API 批量通用调用、智能风控节流与自动化历史审计
            </p>
          </div>
        </div>

        {/* 视图分段切换器 (Segmented Switch) */}
        <div className="flex items-center w-full sm:w-auto rounded-xl bg-slate-100 dark:bg-slate-800/80 p-0.5 border border-slate-200/80 dark:border-slate-750 shadow-inner">
          <button
            type="button"
            onClick={() => setBatchView('runner')}
            className={`flex flex-1 sm:flex-initial items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              batchView === 'runner'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/60 dark:border-slate-650'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Play className="h-3.5 w-3.5" />
            <span>批量任务执行</span>
          </button>

          <button
            type="button"
            onClick={() => setBatchView('history')}
            className={`flex flex-1 sm:flex-initial items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              batchView === 'history'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/60 dark:border-slate-650'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            <span>历史执行台账</span>
            {historyList.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold">
                {historyList.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {batchView === 'history' ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <HistoryPanel onSwitchToBatch={() => setBatchView('runner')} isEmbedded={true} />
        </div>
      ) : (
        /* 弹性上下窗格：上方为任务配置与数据表格，下方为自适应流式终端 */
        <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
          <Group groupRef={batchGroupRef} orientation="vertical" className="flex-1 min-h-0">
          {/* Top Panel: Task Configuration & Data Preview */}
          <Panel id="config-panel" defaultSize={58} minSize={25}>
            <div className="flex h-full flex-col overflow-y-auto p-4 space-y-3">
              {/* 1. 常用高频运维预设场景区 (支持紧凑胶囊行 / 展开完整卡片) */}
              <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900 transition-all">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      高频运维场景预设
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono text-slate-500 border-slate-200 dark:border-slate-800 py-0 px-1.5 h-4"
                    >
                      {presets.length}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Active preset direct template download */}
                    {selectedPreset && (
                      <a
                        href={`/api/batch/presets/${selectedPreset.id}/csv`}
                        download={selectedPreset.filename}
                        className="text-[11px] font-medium py-0.5 px-2 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                        title={`下载「${selectedPreset.title}」标准 CSV 模板`}
                      >
                        <Download className="h-3 w-3" />
                        <span>下载「{selectedPreset.title.replace('批量', '')}」模板</span>
                      </a>
                    )}

                    {/* Expand/Collapse Toggle Button */}
                    <button
                      type="button"
                      onClick={() => setIsPresetsExpanded(!isPresetsExpanded)}
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-0.5 cursor-pointer px-1 py-0.5"
                    >
                      <span>{isPresetsExpanded ? '收起卡片' : '展开场景卡片'}</span>
                      {isPresetsExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Compact Pills Row (紧凑模式：极大地释放纵向展示空间) */}
                {!isPresetsExpanded ? (
                  <div className="flex items-center gap-2 mt-2.5 overflow-x-auto pb-1 scrollbar-thin">
                    {presets.map((preset) => {
                      const isSelected = activePresetId === preset.id || apiId === preset.api_id
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyPreset(preset, true)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-2xs font-bold ring-1 ring-blue-500/20'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700'
                          }`}
                          title={`${preset.title}\n${preset.description}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              preset.tag_color === 'rose'
                                ? 'bg-rose-500'
                                : preset.tag_color === 'amber'
                                ? 'bg-amber-500'
                                : preset.tag_color === 'blue'
                                ? 'bg-blue-500'
                                : preset.tag_color === 'emerald'
                                ? 'bg-emerald-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span>{preset.title.replace('批量', '')}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  /* Expanded Grid Cards (完整展开卡片视图) */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {presets.map((preset) => {
                      const isSelected = activePresetId === preset.id || apiId === preset.api_id
                      return (
                        <div
                          key={preset.id}
                          className={`rounded-xl border p-3 flex flex-col justify-between transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 dark:border-blue-700 shadow-xs ring-1 ring-blue-500/20'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPresetBadgeColor(
                                  preset.tag_color
                                )}`}
                              >
                                {preset.tag}
                              </span>
                              <span
                                className="font-mono text-[9px] text-slate-400 truncate max-w-[85px]"
                                title={preset.command}
                              >
                                {preset.command.split('/').pop()}
                              </span>
                            </div>
                            <h4
                              className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1 mb-1"
                              title={preset.title}
                            >
                              {preset.title}
                            </h4>
                            <p
                              className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-2.5"
                              title={preset.description}
                            >
                              {preset.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                            <button
                              type="button"
                              onClick={() => applyPreset(preset, true)}
                              className="flex-1 text-[11px] font-semibold py-1 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer text-center"
                              title="一键载入该场景的样本数据并切换目标接口"
                            >
                              载入数据
                            </button>
                            <a
                              href={`/api/batch/presets/${preset.id}/csv`}
                              download={preset.filename}
                              className="text-[11px] font-medium py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                              title="下载标准 CSV 表格模板"
                            >
                              <Download className="h-3 w-3" />
                              <span>模板</span>
                            </a>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 2. 目标接口配置与智能风控护栏卡片 */}
              <Card className="border-slate-200/90 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
                <CardContent className="p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Target API Selection */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        目标 REST 接口:
                      </span>
                      <select
                        value={apiId}
                        onChange={(e) => setApiId(e.target.value)}
                        className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs truncate dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {apis.map((api) => (
                          <option key={api.api_id} value={api.api_id}>
                            [{api.category}] {api.name} ({api.command})
                          </option>
                        ))}
                      </select>
                      {selectedApi && (
                        <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                          {selectedApi.command}
                        </span>
                      )}
                    </div>

                    {/* Delay Interval with QPS indicator */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        执行间隔 (Rate Limit):
                      </span>
                      <select
                        value={delaySec}
                        onChange={(e) => setDelaySec(Number(e.target.value))}
                        className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-mono font-medium text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <option value={0.02}>20ms (高速 50 QPS - 仅限高频接口)</option>
                        <option value={0.05}>50ms (推荐 20 QPS - 稳健通用)</option>
                        <option value={0.1}>100ms (10 QPS - 推荐群组/安全接口)</option>
                        <option value={0.25}>250ms (4 QPS - 低频/AI翻译保护)</option>
                        <option value={0.5}>500ms (2 QPS - 风控安全低速)</option>
                        <option value={1.0}>1000ms (1 QPS - 极慢巡检)</option>
                      </select>
                    </div>

                    {/* Data Actions */}
                    <div className="flex items-center gap-2">
                      {items.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearItems}
                          className="h-8 text-xs text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          清空当前数据 ({items.length}条)
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 3. 智能风控与 QPS 建议横条 (Smart Safety Guidance Banner) */}
                  {guidance && (
                    <div className="space-y-2 pt-0.5">
                      {/* 高危接口拦截提示 */}
                      {guidance.risk_level === 'HIGH_RISK' && (
                        <div className="rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5 shadow-2xs">
                          <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5 flex-1">
                            <p className="font-bold flex items-center gap-1.5">
                              <span>高危管控接口警示</span>
                              <Badge variant="destructive" className="text-[9px] px-1 py-0 font-mono">
                                严格限制
                              </Badge>
                            </p>
                            <p className="text-[11px] leading-relaxed opacity-90">{guidance.tip}</p>
                          </div>
                        </div>
                      )}

                      {/* 原生批量替代建议 */}
                      {guidance.native_alternative && (
                        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/40 p-3 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-3 shadow-2xs">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span className="leading-relaxed">{guidance.tip}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setApiId(guidance.native_alternative!.api_id)}
                            className="h-7 px-2.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 cursor-pointer shrink-0 gap-1"
                          >
                            <span>切换至「{guidance.native_alternative.name}」</span>
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {/* AI 翻译费率提示 */}
                      {guidance.risk_level === 'AI_EXPENSIVE' && (
                        <div className="rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/70 dark:bg-purple-950/40 p-3 text-xs text-purple-900 dark:text-purple-200 flex items-center gap-2.5 shadow-2xs">
                          <Info className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                          <span className="leading-relaxed">{guidance.tip}</span>
                        </div>
                      )}

                      {/* 单例接口提示 */}
                      {guidance.risk_level === 'SINGLETON' && (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-850 p-2.5 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                          <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{guidance.tip}</span>
                        </div>
                      )}

                      {/* 官方调用频控展示 */}
                      {guidance.rate_limit && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 px-3 py-1.5 rounded-lg border border-slate-200/70 dark:border-slate-800">
                          <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>
                            官方调用频控：<strong>{guidance.rate_limit}</strong>
                            {guidance.min_delay > 0.05 && (
                              <span className="text-amber-600 dark:text-amber-400 ml-1">
                                (系统已自动推荐并锁定最低执行间隔 ≥{guidance.min_delay}s，避免触发 90001 限流)
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dropzone with @dnd-kit */}
                  <Dropzone />

                  {/* Data Preview Table */}
                  {items.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          待处理数据预览 ({items.length} 条记录)
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          仅展示前 5 条，支持列名智能模糊对齐
                        </span>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-300">
                              <th className="py-1.5 px-3 w-12 font-mono text-[10px]">#</th>
                              {Object.keys(items[0]).map((col) => (
                                <th key={col} className="py-1.5 px-3 font-mono text-[11px]">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                            {items.slice(0, 5).map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60">
                                <td className="py-1.5 px-3 text-slate-400 dark:text-slate-500">{idx + 1}</td>
                                {Object.keys(items[0]).map((col) => (
                                  <td key={col} className="py-1.5 px-3 truncate max-w-xs">
                                    {String(row[col] ?? '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </Panel>

          {!isTerminalCollapsed && (
            <>
              {/* Resizable Divider (支持双击展开/还原) */}
              <ResizeHandle
                direction="vertical"
                disableDoubleClick={true}
                onDoubleClick={handleToggleTerminalHeight}
                title="双击在展开/还原终端面板高度之间切换，也可上下拖拽调整"
              />

              {/* Bottom Panel: Progress & Live Terminal Stream (深浅色无缝自适应) */}
              <Panel id="terminal-panel" defaultSize={42} minSize={18}>
                <div className="flex h-full flex-col bg-slate-50/80 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden border-t border-slate-200/80 dark:border-slate-800/90">
                  {/* Control & Progress Header */}
                  <div
                    onDoubleClick={handleToggleTerminalHeight}
                    title="双击在展开/还原终端高度之间切换"
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 px-4 py-2 select-none shadow-2xs cursor-pointer"
                  >
                    {/* Task status & Controls */}
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        实时流式终端日志 (SSE Stream)
                      </span>

                      {activeTaskId && (
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                        >
                          ID: {activeTaskId}
                        </Badge>
                      )}

                      {isDryRun && (
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700/60 bg-violet-50 dark:bg-violet-950/40"
                        >
                          <Eye className="h-2.5 w-2.5 mr-1 text-violet-600 dark:text-violet-400 inline" />
                          预览演练模式
                        </Badge>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {/* Dry Run Toggle */}
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors mr-1"
                      >
                        <input
                          type="checkbox"
                          checked={isDryRun}
                          onChange={(e) => setDryRun(e.target.checked)}
                          disabled={isRunning}
                          className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-violet-600 focus:ring-violet-500/20 focus:ring-offset-0 h-3.5 w-3.5 cursor-pointer accent-violet-600"
                        />
                        <span
                          className={`flex items-center gap-1 font-medium ${
                            isDryRun
                              ? 'text-violet-700 dark:text-violet-300 font-semibold'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <Eye className="h-3 w-3" />
                          预览模式
                        </span>
                      </label>

                      {!isRunning ? (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStart()
                          }}
                          disabled={items.length === 0}
                          className={`h-7 gap-1 px-3 text-xs text-white shadow-xs transition-colors cursor-pointer ${
                            isDryRun
                              ? 'bg-violet-600 hover:bg-violet-700'
                              : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          {isDryRun ? (
                            <>
                              <Eye className="h-3 w-3" />
                              <span>开始预览演练 (Dry-Run)</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3 fill-current" />
                              <span>启动批处理</span>
                            </>
                          )}
                        </Button>
                      ) : (
                        <>
                          {!isPaused ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                pauseBatch()
                              }}
                              className="h-7 gap-1 px-3 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-200 dark:border-amber-800 cursor-pointer"
                            >
                              <Pause className="h-3 w-3" />
                              <span>暂停</span>
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                resumeBatch()
                              }}
                              className="h-7 gap-1 px-3 text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                            >
                              <Play className="h-3 w-3 fill-current" />
                              <span>继续</span>
                            </Button>
                          )}

                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              stopBatch()
                            }}
                            className="h-7 gap-1 px-3 text-xs cursor-pointer"
                          >
                            <Square className="h-3 w-3 fill-current" />
                            <span>强制终止</span>
                          </Button>
                        </>
                      )}

                      {/* 失败项重试与导出 */}
                      {!isRunning && failedItems.length > 0 && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            retryFailed()
                          }}
                          className="h-7 gap-1 px-2.5 text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-xs font-medium cursor-pointer"
                          title="自动提取上次执行失败的记录至待执行列表，方便修改参数或直接重试"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>重试失败项 ({failedItems.length})</span>
                        </Button>
                      )}

                      {activeTaskId && progress.failed > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleExportCsv(true)
                          }}
                          className="h-7 gap-1 px-2.5 text-xs text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 cursor-pointer"
                          title="仅导出本次执行失败的记录为 CSV"
                        >
                          <Download className="h-3 w-3" />
                          <span>导出失败 CSV</span>
                        </Button>
                      )}

                      {activeTaskId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleExportCsv(false)
                          }}
                          className="h-7 gap-1 px-2.5 text-xs text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                          title="导出包含所有执行结果、状态码、耗时与错误详情的对账 CSV"
                        >
                          <Download className="h-3 w-3" />
                          <span>导出对账报告 CSV</span>
                        </Button>
                      )}

                      {activeTaskId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setBatchView('history')
                          }}
                          className="h-7 gap-1 px-2.5 text-xs text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer font-medium"
                          title="就地切换至历史台账查看该任务的完整执行详情与历史归档"
                        >
                          <Clock className="h-3 w-3 text-amber-500" />
                          <span>查看历史台账</span>
                        </Button>
                      )}

                      {/* 清空终端屏幕 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          clearLogs()
                        }}
                        title="清空终端屏幕"
                        className="h-7 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>

                      {/* 放大/还原高度 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleTerminalHeight()
                        }}
                        title={isTerminalMaximized ? '还原高度' : '最大化终端高度'}
                        className="h-7 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 cursor-pointer"
                      >
                        {isTerminalMaximized ? (
                          <Minimize2 className="h-3.5 w-3.5" />
                        ) : (
                          <Maximize2 className="h-3.5 w-3.5" />
                        )}
                      </Button>

                      {/* 收起控制台到底部状态栏 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setIsTerminalCollapsed(true)
                        }}
                        title="收起控制台到底部状态栏"
                        className="h-7 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 cursor-pointer"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Progress Metrics Bar */}
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/50 px-4 py-1.5 font-mono text-xs">
                    <div className="flex items-center gap-4">
                      <span className="text-slate-500 dark:text-slate-400">
                        进度: <strong className="text-slate-900 dark:text-white">{progress.percent}%</strong> ({progress.current}/{progress.total})
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        成功: <strong>{progress.success}</strong>
                      </span>
                      <span
                        className={
                          progress.failed > 0
                            ? 'text-rose-600 dark:text-rose-400 font-bold'
                            : 'text-slate-400 dark:text-slate-500'
                        }
                      >
                        失败: <strong>{progress.failed}</strong>
                      </span>
                    </div>

                    {/* Progress bar line */}
                    <div className="w-48 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.percent}%` }}
                        transition={{ ease: 'easeOut', duration: 0.2 }}
                      />
                    </div>
                  </div>

                  {/* Terminal Log Output (Light/Dark 自适应底色) */}
                  <div
                    ref={logContainerRef}
                    className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5 select-text bg-slate-50/50 dark:bg-slate-950/70"
                  >
                    {logs.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-slate-400 dark:text-slate-600">
                        <span>等待批处理指令执行...</span>
                      </div>
                    ) : (
                      logs.map((log) => {
                        let tagClass =
                          'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/60 dark:border-blue-800/60'
                        if (log.tag === 'SUCCESS')
                          tagClass =
                            'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/60 dark:border-emerald-800/60'
                        if (log.tag === 'FAILED')
                          tagClass =
                            'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/60 dark:border-rose-800/60'
                        if (log.tag === 'WARN')
                          tagClass =
                            'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/60 dark:border-amber-800/60'

                        return (
                          <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                            <span className="text-slate-400 dark:text-slate-500 shrink-0 text-[11px]">
                              {log.time}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.2 text-[10px] font-bold border shrink-0 ${tagClass}`}
                            >
                              {log.tag}
                            </span>
                            <span className="text-slate-800 dark:text-slate-200 break-all flex-1">
                              {log.msg}
                            </span>
                            {log.cost !== undefined && (
                              <span className="text-slate-400 dark:text-slate-500 text-[10px] shrink-0 font-mono">
                                {log.cost}ms
                              </span>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </Panel>
            </>
          )}
        </Group>

        {/* 当终端面板收起时展示底部状态栏 (与接口调试页统一体验) */}
        {isTerminalCollapsed && (
          <div
            onClick={() => setIsTerminalCollapsed(false)}
            className="h-10 px-4 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-850 border-t-2 border-emerald-500 flex items-center justify-between cursor-pointer select-none transition-colors shrink-0 z-20 shadow-sm"
            title="点击展开实时流式终端日志"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <ChevronUp className="h-4 w-4 text-emerald-500 animate-bounce" />
                <span>实时终端控制台</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                  (已收起，点击展开)
                </span>
              </div>

              {isRunning ? (
                <Badge className="font-mono text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400">
                  执行中: {progress.percent}% ({progress.current}/{progress.total})
                </Badge>
              ) : activeTaskId ? (
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-slate-500 dark:text-slate-400">
                    上次任务: {progress.percent}%
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    成: {progress.success}
                  </span>
                  {progress.failed > 0 && (
                    <span className="text-rose-600 dark:text-rose-400 font-bold">
                      败: {progress.failed}
                    </span>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span>点击或双击展开控制台</span>
              <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
