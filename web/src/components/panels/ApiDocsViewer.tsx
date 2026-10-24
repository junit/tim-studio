import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Send,
  Clock,
  ShieldAlert,
  FileCode,
  Layers,
  Search,
  X,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { JsonCodeEditor } from '@/components/common/JsonCodeEditor'
import { ApiMeta, useApiStore } from '@/stores/apiStore'

export interface UrlParamItem {
  name: string
  description: string
}

export interface RequestFieldItem {
  name: string
  type: string
  required: string
  description: string
}

export interface ExampleItem {
  title: string
  content: string
  clean_json?: string
}

export interface ResponseFieldItem {
  name: string
  type: string
  description: string
}

export interface ErrorCodeItem {
  code: string
  description: string
  solution?: string
}

export interface StructuredDoc {
  doc_id: number
  api_id: string
  title: string
  doc_url: string
  sync_time: string | null
  status: 'synced' | 'not_synced' | 'error'
  source_mode?: 'html' | 'api'
  requested_mode?: 'auto' | 'html' | 'api'
  overview: string
  rate_limit?: string
  request_url_sample?: string
  url_params: UrlParamItem[]
  request_body_fields: RequestFieldItem[]
  request_examples: ExampleItem[]
  response_body_fields: ResponseFieldItem[]
  response_examples: ExampleItem[]
  error_codes: ErrorCodeItem[]
  callbacks?: string[]
  notes?: string[]
}

export interface DocSyncStatus {
  is_running: boolean
  total: number
  completed: number
  success_count: number
  error_count: number
  percent: number
  current_name: string
  current_doc_id: number
  start_time: string | null
  end_time: string | null
  errors: Array<{ doc_id: number; name: string; error: string }>
}

export interface DocSummary {
  total_apis: number
  synced_count: number
  not_synced_count: number
  synced_percent: number
  last_sync_time: string | null
  is_running: boolean
}

interface ApiDocsViewerProps {
  api: ApiMeta
  onApplyExample?: (example: ExampleItem) => void
  onToggleExpand?: () => void
  isExpanded?: boolean
}

export const ApiDocsViewer: React.FC<ApiDocsViewerProps> = ({
  api,
  onApplyExample,
  onToggleExpand,
  isExpanded = false,
}) => {
  const { updateActiveTab, showToast } = useApiStore()

  const [doc, setDoc] = useState<StructuredDoc | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncingSingle, setIsSyncingSingle] = useState(false)
  const [syncMode, setSyncMode] = useState<'auto' | 'html' | 'api'>('auto')
  const [activeReqExampleIdx, setActiveReqExampleIdx] = useState(0)
  const [activeRespExampleIdx, setActiveRespExampleIdx] = useState(0)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [errorSearch, setErrorSearch] = useState('')
  const [isSelfModalOpen, setIsSelfModalOpen] = useState(false)

  // 批量同步弹窗状态
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [syncStatus, setSyncStatus] = useState<DocSyncStatus | null>(null)
  const [summary, setSummary] = useState<DocSummary | null>(null)
  const pollTimerRef = useRef<any>(null)

  const handleCopyText = (text: string, label: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedKey(text)
    showToast({
      type: 'success',
      message: `已复制 ${label}: ${text}`,
    })
    setTimeout(() => {
      setCopiedKey((prev) => (prev === text ? null : prev))
    }, 1500)
  }

  const renderCopyableFieldName = (
    name: string,
    label: string = '字段名',
    colorClass: string = 'text-slate-900 dark:text-slate-100'
  ) => (
    <div
      onClick={() => handleCopyText(name, label)}
      className={`group/copy inline-flex items-center gap-1.5 font-mono font-bold ${colorClass} hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors select-text`}
      title={`点击复制 ${label}`}
    >
      <span>{name}</span>
      {copiedKey === name ? (
        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
      ) : (
        <Copy className="h-2.5 w-2.5 opacity-0 group-hover/copy:opacity-80 text-slate-400 hover:text-blue-500 transition-opacity shrink-0" />
      )}
    </div>
  )

  // 1. 获取当前接口的结构化文档
  const fetchDoc = async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    try {
      const res = await fetch(`/api/docs/${api.api_id}`)
      const data = await res.json()
      if (data.status === 'success') {
        setDoc(data.data)
        setActiveReqExampleIdx(0)
        setActiveRespExampleIdx(0)
      }
    } catch (e) {
      console.error('Failed to load doc', e)
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }

  // 2. 获取文档汇总
  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/docs/summary')
      const data = await res.json()
      if (data.status === 'success') {
        setSummary(data.data)
      }
    } catch (e) {
      console.error('Failed to fetch summary', e)
    }
  }

  // 3. 轮询同步状态
  const pollStatus = async () => {
    try {
      const res = await fetch('/api/docs/sync/status')
      const data = await res.json()
      if (data.status === 'success') {
        const s: DocSyncStatus = data.data
        setSyncStatus(s)
        if (s.is_running) {
          pollTimerRef.current = setTimeout(pollStatus, 800)
        } else {
          fetchSummary()
          fetchDoc(false)
        }
      }
    } catch (e) {
      console.error('Failed to poll status', e)
    }
  }

  useEffect(() => {
    fetchDoc(true)
    fetchSummary()
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [api.api_id])

  // 单接口即时同步 (支持指定数据源模式)
  const handleSingleSync = async (modeToUse: 'auto' | 'html' | 'api' = syncMode) => {
    setIsSyncingSingle(true)
    try {
      const res = await fetch(`/api/docs/sync/${api.api_id}?mode=${modeToUse}`, { method: 'POST' })
      const data = await res.json()
      if (data.status === 'success') {
        setDoc(data.data)
        fetchSummary()
        const srcText = data.data.source_mode === 'html' ? '静态网页 HTML' : '动态接口 API'
        showToast({
          type: 'success',
          message: `接口「${api.name}」官方文档已通过【${srcText}】同步成功！`,
        })
      } else {
        showToast({
          type: 'warning',
          message: data.detail || '同步官方文档遇到问题',
        })
      }
    } catch (e: any) {
      showToast({
        type: 'warning',
        message: `同步异常: ${e.message}`,
      })
    } finally {
      setIsSyncingSingle(false)
    }
  }

  // 触发后台异步批量同步 (支持指定数据源模式)
  const handleStartBatchSync = async (force: boolean = false, modeToUse: 'auto' | 'html' | 'api' = syncMode) => {
    try {
      const res = await fetch('/api/docs/sync/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force, mode: modeToUse }),
      })
      const data = await res.json()
      if (data.status === 'success') {
        const modeLabel = modeToUse === 'html' ? '静态网页 HTML' : modeToUse === 'api' ? '动态接口 API' : '智能混合'
        showToast({
          type: 'info',
          message: force
            ? `已启动全量覆盖批量同步任务 [${modeLabel}]`
            : `已启动增量批量同步任务 [${modeLabel}]`,
        })
        pollStatus()
      }
    } catch (e: any) {
      showToast({
        type: 'warning',
        message: `启动批量同步失败: ${e.message}`,
      })
    }
  }

  // 取消批量同步
  const handleCancelBatchSync = async () => {
    try {
      await fetch('/api/docs/sync/cancel', { method: 'POST' })
      showToast({ type: 'info', message: '已请求取消批量同步' })
      pollStatus()
    } catch (e: any) {
      console.error('Failed to cancel sync', e)
    }
  }

  // 复制内容
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1800)
    showToast({ type: 'info', message: '已复制到剪贴板' })
  }

  // 将请求示例应用到当前工作台 Body 中
  const handleApplyExampleToRequest = (example: ExampleItem) => {
    if (onApplyExample) {
      onApplyExample(example)
      showToast({
        type: 'success',
        message: `已将示例「${example.title}」载入请求体，已自动切至 Body 标签`,
      })
      return
    }

    const rawToApply = example.clean_json || example.content
    try {
      const parsed = JSON.parse(rawToApply)
      updateActiveTab({
        formData: parsed,
        jsonText: JSON.stringify(parsed, null, 2),
        jsonError: null,
        isModified: true,
        requestTab: 'body',
      })
      showToast({
        type: 'success',
        message: `已将示例「${example.title}」载入请求体，已自动切至 Body 标签`,
      })
    } catch {
      updateActiveTab({
        jsonText: rawToApply,
        isModified: true,
        requestTab: 'body',
        bodyMode: 'json',
      })
      showToast({
        type: 'info',
        message: `已将示例文本载入请求体 (JSON Raw 模式)`,
      })
    }
  }

  // 错误码过滤
  const filteredErrorCodes = useMemo(() => {
    if (!doc?.error_codes) return []
    if (!errorSearch.trim()) return doc.error_codes
    const q = errorSearch.trim().toLowerCase()
    return doc.error_codes.filter(
      (ec) =>
        ec.code.toLowerCase().includes(q) ||
        ec.description.toLowerCase().includes(q) ||
        (ec.solution && ec.solution.toLowerCase().includes(q))
    )
  }, [doc?.error_codes, errorSearch])

  // 解析并格式化功能说明为逐项列表
  const overviewLines = useMemo(() => {
    if (!doc?.overview) return []
    return doc.overview
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('以下视频') && l !== '﻿')
  }, [doc?.overview])

  // 结构化解析频率限制与配额规则
  const parsedRateLimit = useMemo(() => {
    if (!doc?.rate_limit) return null
    const raw = doc.rate_limit.trim()

    // 核心频率标签提取 (如 200次/秒, 1000条/天, 1次/s, 每秒100次)
    const coreMatch = raw.match(
      /(\d+\s*次\s*\/\s*[秒sS天日分]+|\d+\s*条\s*\/\s*[秒sS天日分]+|每秒\s*\d+\s*次|\d+\s*次\s*\/\s*s)/i
    )
    let coreBadge = coreMatch ? coreMatch[1].replace(/\s+/g, '') : ''
    if (!coreBadge) {
      coreBadge = raw.length <= 16 ? raw : raw.slice(0, 15) + '...'
    }

    // 分离正文与注意事项
    let mainText = raw
    let noticeItems: string[] = []
    const noticeMatch = raw.match(/注意[：:](.*)/s)
    if (noticeMatch) {
      mainText = raw.slice(0, noticeMatch.index).trim()
      noticeItems = noticeMatch[1]
        .split(/[。\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    }

    // 提取主要规则条目
    const ruleItems = mainText
      .split(/[。\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    // 提取关键配额指标 (e.g. 默认接口请求频率限制：200次/秒, 默认发送消息条数限制：12000条/分钟)
    const metricMatches = Array.from(
      raw.matchAll(
        /([^：:，,。\n]{2,14})[：:]\s*([0-9]+(?:\.[0-9]+)?\s*(?:次|条|KB|秒|s)\s*(?:\/\s*(?:秒|分|分钟|天|日|s))?)/g
      )
    )
    const metrics = metricMatches.map((m) => ({
      label: m[1].trim().replace(/^(默认|后台接口限制了|建议使用)/, ''),
      value: m[2].trim(),
    }))

    return {
      raw,
      coreBadge,
      isComplex: raw.length > 25 || noticeItems.length > 0 || ruleItems.length > 1,
      metrics,
      rules: ruleItems,
      notices: noticeItems,
    }
  }, [doc?.rate_limit])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">正在载入官方结构化文档...</p>
      </div>
    )
  }

  const isSynced = doc && doc.status === 'synced'

  return (
    <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300 pb-12">
      {/* 顶部操作与同步状态栏 */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white shrink-0">
              POST
            </span>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
              {doc?.title || api.name}
            </h3>

            {isSynced ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge
                  variant="outline"
                  className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[10px] gap-1 px-1.5 py-0"
                >
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  <span>已同步 · {doc?.sync_time}</span>
                </Badge>
                {doc?.source_mode && (
                  <span
                    className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                    title={doc.source_mode === 'html' ? '通过解析官方静态 HTML 网页获得' : '通过官方 getDocPageDetail 接口获得'}
                  >
                    {doc.source_mode === 'html' ? '网页 HTML' : '动态 API'}
                  </span>
                )}
              </div>
            ) : (
              <Badge
                variant="outline"
                className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[10px] gap-1 px-1.5 py-0 shrink-0"
              >
                <AlertCircle className="h-2.5 w-2.5" />
                <span>未同步官方结构</span>
              </Badge>
            )}
          </div>

          {/* 操作按钮区 */}
          <div className="flex items-center gap-2">
            {api.doc_url && (
              <a
                href={api.doc_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs transition-colors"
                title="在新窗口打开腾讯云官网原生文档"
              >
                <span>官方文档</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            {/* 数据源模式选择器 */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 h-7 text-xs">
              <span className="text-slate-400 dark:text-slate-500 text-[10px]">模式:</span>
              <select
                value={syncMode}
                onChange={(e) => setSyncMode(e.target.value as any)}
                className="bg-transparent text-slate-700 dark:text-slate-200 font-medium text-xs outline-none cursor-pointer"
                title="切换数据源模式：智能混合 / 静态网页抓取 / 动态接口"
              >
                <option value="auto" className="dark:bg-slate-800">智能混合</option>
                <option value="html" className="dark:bg-slate-800">静态网页抓取</option>
                <option value="api" className="dark:bg-slate-800">动态接口</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSingleSync(syncMode)}
              disabled={isSyncingSingle}
              className="h-7 text-xs border-slate-200 dark:border-slate-750 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 gap-1.5 font-semibold cursor-pointer shadow-2xs"
              title="根据所选模式重新抓取官方文档并结构化保存"
            >
              <RefreshCw className={`h-3 w-3 ${isSyncingSingle ? 'animate-spin' : ''}`} />
              <span>{isSyncingSingle ? '同步中...' : '同步此文档'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowBatchModal(true)
                pollStatus()
                fetchSummary()
              }}
              className="h-7 text-xs border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 gap-1.5 font-medium cursor-pointer shadow-2xs"
              title="打开全量 166 个 REST API 文档批量同步面板"
            >
              <Layers className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <span>批量同步</span>
            </Button>

            {/* 放大阅读操作 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (onToggleExpand) {
                  onToggleExpand()
                } else {
                  setIsSelfModalOpen(true)
                }
              }}
              className="h-7 text-xs border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 gap-1.5 font-medium cursor-pointer shadow-2xs"
              title="放大阅读该接口文档"
            >
              <Maximize2 className="h-3 w-3 text-slate-500 dark:text-slate-400" />
              <span>{isExpanded ? '还原' : '放大阅读'}</span>
            </Button>
          </div>
        </div>

        {/* 基础接口调用说明 */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-y-1 gap-x-4 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          <div>
            接口协议: <span className="font-bold text-slate-700 dark:text-slate-300">HTTPS POST (JSON)</span>
          </div>
          <div>
            请求路径: <span className="font-bold text-blue-600 dark:text-blue-400">{api.command.startsWith('v4/') ? api.command : `v4/${api.service_name}/${api.command}`}</span>
          </div>
          {parsedRateLimit && (
            <div
              className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 bg-amber-50/90 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200/80 dark:border-amber-800/80 font-sans text-[11px]"
              title={parsedRateLimit.raw}
            >
              <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-amber-700 dark:text-amber-400">频率限制:</span>
              <span className="font-mono font-bold text-amber-900 dark:text-amber-200">{parsedRateLimit.coreBadge}</span>
              {parsedRateLimit.isComplex && (
                <span className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60 px-1 py-0.2 rounded font-medium">
                  详细规则见下方
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 频率限制与配额规则卡片 (格式化结构化呈现) */}
      {parsedRateLimit && (
        <div className="rounded-xl border border-amber-200/90 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/30 p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <h4 className="font-bold text-xs text-amber-950 dark:text-amber-200">接口调用频率限制与配额</h4>
            </div>
            <Badge
              variant="outline"
              className="bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-mono text-[10px]"
            >
              基准频控: {parsedRateLimit.coreBadge}
            </Badge>
          </div>

          {/* 关键配额指标 */}
          {parsedRateLimit.metrics.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {parsedRateLimit.metrics.map((m, idx) => (
                <div
                  key={idx}
                  className="rounded-lg bg-white/95 dark:bg-slate-850 border border-amber-200/80 dark:border-amber-800/60 p-2 flex flex-col justify-between"
                >
                  <span className="text-[10px] text-amber-800/80 dark:text-amber-400 font-medium truncate">{m.label}</span>
                  <span className="text-xs font-mono font-bold text-amber-950 dark:text-amber-200 mt-0.5">{m.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* 规则细项逐条展示 */}
          <div className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
            {parsedRateLimit.rules.map((rule, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-amber-500 font-bold shrink-0 mt-0.5">•</span>
                <span className="leading-relaxed">{rule}</span>
              </div>
            ))}
          </div>

          {/* 注意事项与配额调整 */}
          {parsedRateLimit.notices.length > 0 && (
            <div className="rounded-lg bg-amber-100/60 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 p-2.5 space-y-1 text-[11px] text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-1 font-bold text-amber-950 dark:text-amber-200 text-[11px]">
                <AlertCircle className="h-3 w-3 text-amber-700 dark:text-amber-400 shrink-0" />
                <span>注意事项与配额调整:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px]">
                {parsedRateLimit.notices.map((n, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 功能详细说明 (官方列表逐项展示) */}
      {overviewLines.length > 0 && (
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
            <Info className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
            <span>功能说明</span>
          </div>
          <ul className="space-y-2 bg-slate-50/70 dark:bg-slate-950/60 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 font-sans text-xs">
            {overviewLines.map((line, idx) => {
              const isNotice = line.startsWith('注意：') || line.startsWith('说明：') || line.startsWith('提示：')
              if (isNotice) {
                const tag = line.slice(0, 3)
                const content = line.slice(3)
                return (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-amber-900 dark:text-amber-200 bg-amber-50/90 dark:bg-amber-950/60 p-2.5 rounded-md border border-amber-200/80 dark:border-amber-800/80 my-1 font-medium"
                  >
                    <span className="font-bold text-[11px] bg-amber-200/80 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100 px-1.5 py-0.2 rounded shrink-0">
                      {tag}
                    </span>
                    <span className="leading-relaxed flex-1">{content}</span>
                  </li>
                )
              }
              return (
                <li key={idx} className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300 leading-relaxed">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400 shrink-0 mt-1.5" />
                  <span className="flex-1">{line}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 请求 URL 官方示例 (Endpoint Sample) */}
      {doc?.request_url_sample && (
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
              <ExternalLink className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
              <span>请求 URL 官方示例 (Endpoint Sample)</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopyText(doc.request_url_sample!.trim(), '请求 URL 示例')}
              className="h-6 px-2 text-[11px] gap-1 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
            >
              <Copy className="h-3 w-3" />
              <span>复制 URL</span>
            </Button>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-850 p-2.5 border border-slate-200/80 dark:border-slate-800 font-mono text-[11px] text-slate-800 dark:text-slate-200 break-all select-text">
            {doc.request_url_sample.trim()}
          </div>
        </div>
      )}

      {/* URL 查询参数说明 (URL Query Parameters) - 紧跟在功能说明之后 */}
      {doc?.url_params && doc.url_params.length > 0 && (
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
              <Info className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>URL 查询参数说明 (Query Parameters)</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
              共 {doc.url_params.length} 项参数
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-2.5 px-3 w-40 whitespace-nowrap">参数名</th>
                  <th className="py-2.5 px-3">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {doc.url_params.map((up, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/60 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap align-top">
                      {renderCopyableFieldName(up.name, 'URL 参数名', 'text-indigo-700 dark:text-indigo-400')}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 leading-relaxed font-sans select-text">
                      {up.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 请求包体示例 (支持多场景切换、一键复制、一键应用到当前请求体) */}
      {doc?.request_examples && doc.request_examples.length > 0 && (
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
              <FileCode className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
              <span>请求包体示例 (Request Body)</span>
            </div>

            {/* 场景切换 Pills */}
            {doc.request_examples.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg max-w-full overflow-x-auto">
                {doc.request_examples.map((ex, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveReqExampleIdx(idx)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                      activeReqExampleIdx === idx
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {ex.title || `场景 ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 选中的请求示例 */}
          {doc.request_examples[activeReqExampleIdx] && (
            <div className="space-y-2">
              <JsonCodeEditor
                value={
                  doc.request_examples[activeReqExampleIdx].clean_json ||
                  doc.request_examples[activeReqExampleIdx].content
                }
                readOnly={true}
                maxHeight="380px"
                minHeight="140px"
                label={doc.request_examples[activeReqExampleIdx].title || '请求示例'}
                extraActions={
                  <Button
                    size="sm"
                    onClick={() =>
                      handleApplyExampleToRequest(doc.request_examples[activeReqExampleIdx])
                    }
                    className="h-6 px-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs cursor-pointer shadow-xs gap-1 font-semibold"
                    title="将此官方示例自动填入当前工作台 Body 中并调试"
                  >
                    <Send className="h-3 w-3" />
                    <span className="text-[11px]">应用到请求体</span>
                  </Button>
                }
              />

              {doc.request_examples[activeReqExampleIdx].title && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  场景说明: <span className="font-medium text-slate-700 dark:text-slate-300">{doc.request_examples[activeReqExampleIdx].title}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 请求包字段说明表格 (Request Fields) */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
            <Sparkles className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
            <span>请求包字段说明 (Request Parameters)</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
            共 {doc?.request_body_fields?.length || 0} 项参数
          </span>
        </div>

        {doc?.request_body_fields && doc.request_body_fields.length > 0 ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-2.5 px-3 w-44 whitespace-nowrap">字段名</th>
                  <th className="py-2.5 px-3 w-28 whitespace-nowrap">类型</th>
                  <th className="py-2.5 px-3 w-28 whitespace-nowrap">属性</th>
                  <th className="py-2.5 px-3">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {doc.request_body_fields.map((field, idx) => {
                  const isRequired = field.required === '必填'
                  const isOptional = field.required === '选填'
                  const isCustomReq = !isRequired && !isOptional && field.required
                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/60 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap align-top">
                        {renderCopyableFieldName(field.name, '请求字段名')}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap align-top">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-750 font-mono text-[10px]">
                          {field.type || 'String'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap align-top">
                        {isRequired && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-800 whitespace-nowrap text-[11px]">
                            必填
                          </span>
                        )}
                        {isOptional && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium border border-slate-200 dark:border-slate-700 whitespace-nowrap text-[11px]">
                            选填
                          </span>
                        )}
                        {isCustomReq && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 font-medium border border-amber-200 dark:border-amber-800 whitespace-nowrap text-[10px]"
                            title={field.required}
                          >
                            {field.required}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                        {field.description}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
            该接口无需特别请求包体参数，或官方文档中以标准示例呈现。
          </p>
        )}
      </div>

      {/* 应答包体示例 (Response Body Examples) */}
      {doc?.response_examples && doc.response_examples.length > 0 && (
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
              <FileCode className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>应答包体示例 (Response Body)</span>
            </div>

            {doc.response_examples.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg max-w-full overflow-x-auto">
                {doc.response_examples.map((ex, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveRespExampleIdx(idx)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                      activeRespExampleIdx === idx
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {ex.title || `应答 ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {doc.response_examples[activeRespExampleIdx] && (
            <JsonCodeEditor
              value={
                doc.response_examples[activeRespExampleIdx].clean_json ||
                doc.response_examples[activeRespExampleIdx].content
              }
              readOnly={true}
              maxHeight="380px"
              minHeight="140px"
              label={doc.response_examples[activeRespExampleIdx].title || '应答示例'}
            />
          )}
        </div>
      )}

      {/* 应答包字段说明 (Response Fields) */}
      {doc?.response_body_fields && doc.response_body_fields.length > 0 && (
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>应答包字段说明 (Response Parameters)</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
              共 {doc.response_body_fields.length} 项参数
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-2.5 px-3 w-48">字段名</th>
                  <th className="py-2.5 px-3 w-28">类型</th>
                  <th className="py-2.5 px-3">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {doc.response_body_fields.map((field, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/60 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap align-top">
                      {renderCopyableFieldName(field.name, '应答字段名')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap align-top">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-750 font-mono text-[10px]">
                        {field.type || 'String'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                      {field.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 官方专属错误码表格 (带即时搜索过滤) */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
            <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
            <span>官方专属错误码速查 (Error Codes)</span>
            <Badge variant="outline" className="text-[10px] ml-1 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono border-slate-200 dark:border-slate-700">
              {filteredErrorCodes.length} 项
            </Badge>
          </div>

          {/* 错误码即时搜索 */}
          {doc?.error_codes && doc.error_codes.length > 5 && (
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={errorSearch}
                onChange={(e) => setErrorSearch(e.target.value)}
                placeholder="搜索错误码或关键字..."
                className="pl-8 pr-7 h-7 text-xs bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-800 dark:text-slate-100 focus-visible:ring-blue-500"
              />
              {errorSearch && (
                <button
                  onClick={() => setErrorSearch('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {filteredErrorCodes.length > 0 ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-2.5 px-3 w-28">错误码</th>
                  <th className="py-2.5 px-3 w-72">含义说明</th>
                  <th className="py-2.5 px-3">处理 / 排查建议</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {filteredErrorCodes.map((ec, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/60 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap align-top">
                      {renderCopyableFieldName(ec.code, '错误码', 'text-rose-700 dark:text-rose-400')}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 leading-relaxed font-sans select-text">
                      {ec.description}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 leading-relaxed font-sans select-text">
                      {ec.solution || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
            {errorSearch ? '未找到符合条件的错误码' : '官方文档中未列出独立错误码表格，通常参考通用错误码定义。'}
          </p>
        )}
      </div>

      {/* 关联回调说明 (Callbacks) */}
      {doc?.callbacks && doc.callbacks.length > 0 && (
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
            <HelpCircle className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
            <span>可能触发的服务端回调 (Third-party Callbacks)</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {doc.callbacks.map((cb, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-medium"
              >
                {cb}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 批量同步弹窗 (Batch Sync Modal) */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    官方文档异步批量同步中心
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    一键抓取腾讯云 166 项 REST API 官方文档并完成结构化解析
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 当前概况卡片 */}
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-700 text-center">
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">接口总计</p>
                <p className="text-base font-bold font-mono text-slate-800 dark:text-slate-200">
                  {summary?.total_apis || 166}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">已同步文档</p>
                <p className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {summary?.synced_count || 0}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">覆盖率</p>
                <p className="text-base font-bold font-mono text-blue-600 dark:text-blue-400">
                  {summary?.synced_percent || 0}%
                </p>
              </div>
            </div>

            {/* 同步进度指示器 */}
            {syncStatus && (
              <div className="space-y-2 p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/30">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    {syncStatus.is_running ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
                        <span>正在后台同步...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>同步就绪</span>
                      </>
                    )}
                  </span>
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                    {syncStatus.completed} / {syncStatus.total} ({syncStatus.percent}%)
                  </span>
                </div>

                {/* 进度条 */}
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 rounded-full"
                    style={{ width: `${syncStatus.percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                  <span className="truncate max-w-[280px]">
                    {syncStatus.current_name ? `当前: ${syncStatus.current_name}` : '就绪'}
                  </span>
                  <span>成功: {syncStatus.success_count} · 失败: {syncStatus.error_count}</span>
                </div>
              </div>
            )}

            {/* 同步数据源模式选择 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-700 text-xs">
              <div className="flex flex-col">
                <span className="font-semibold text-slate-800 dark:text-slate-200">数据源模式选择</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  静态网页抓取抗封防限频；动态接口体积小解析快
                </span>
              </div>
              <select
                value={syncMode}
                onChange={(e) => setSyncMode(e.target.value as any)}
                className="h-7 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-slate-700 dark:text-slate-200 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="auto">智能混合 (优先API+失败回退HTML)</option>
                <option value="html">静态网页抓取 (HTML 避频控)</option>
                <option value="api">动态接口 (getDocPageDetail)</option>
              </select>
            </div>

            {/* 操作控制按钮 */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              {syncStatus?.is_running ? (
                <Button
                  variant="outline"
                  onClick={handleCancelBatchSync}
                  className="border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs"
                >
                  终止任务
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleStartBatchSync(false, syncMode)}
                    className="text-xs border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    增量同步 (仅未同步项)
                  </Button>
                  <Button
                    onClick={() => handleStartBatchSync(true, syncMode)}
                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                  >
                    全量重新同步 (覆盖所有)
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 沉浸式放大/全屏阅读弹窗 */}
      {isSelfModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-150">
          <div className="w-full max-w-6xl h-[92vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                  {doc?.title || api.name} - 沉浸式文档阅读
                </h3>
                <span className="font-mono text-xs text-slate-400 dark:text-slate-500 shrink-0 hidden sm:inline">
                  {api.command}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setIsSelfModalOpen(false)}
                  variant="ghost"
                  className="h-7 px-2.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 gap-1 cursor-pointer"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span>退出放大</span>
                </Button>
                <button
                  onClick={() => setIsSelfModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 dark:bg-slate-950/60">
              <ApiDocsViewer
                api={api}
                onApplyExample={onApplyExample}
                onToggleExpand={() => setIsSelfModalOpen(false)}
                isExpanded={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
