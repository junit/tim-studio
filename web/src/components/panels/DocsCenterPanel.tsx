import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  BookOpen,
  RefreshCw,
  Search,
  ExternalLink,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileCode,
  ShieldAlert,
  Send,
  X,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Filter,
  Check,
  Maximize2,
  Minimize2,
  ChevronRight,
  Folder,
  FolderOpen,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApiStore, ApiMeta } from '@/stores/apiStore'
import { ApiDocsViewer } from '@/components/panels/ApiDocsViewer'

interface DocSummary {
  total_apis: number
  synced_count: number
  not_synced_count: number
  synced_percent: number
  last_sync_time: string | null
  is_running: boolean
}

interface DocSyncStatus {
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

interface DocsCenterPanelProps {
  onNavigateToSandbox?: (api: ApiMeta) => void
}

export const DocsCenterPanel: React.FC<DocsCenterPanelProps> = ({ onNavigateToSandbox }) => {
  const { apis, openTab, showToast, fetchApis } = useApiStore()

  const [summary, setSummary] = useState<DocSummary | null>(null)
  const [syncStatus, setSyncStatus] = useState<DocSyncStatus | null>(null)
  const [search, setSearch] = useState('')
  const [selectedLevel1, setSelectedLevel1] = useState<string>('all')
  const [selectedLevel2, setSelectedLevel2] = useState<string>('all')
  const [selectedLevel3, setSelectedLevel3] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'synced' | 'not_synced'>('all')
  const [selectedApiIds, setSelectedApiIds] = useState<Set<string>>(new Set())
  const [syncingApiId, setSyncingApiId] = useState<string | null>(null)
  const [isSyncingTree, setIsSyncingTree] = useState(false)
  const [syncMode, setSyncMode] = useState<'auto' | 'html' | 'api'>('auto')
  const [isDrawerMaximized, setIsDrawerMaximized] = useState(false)

  // 正在查看完整文档的 API（打开抽屉）
  const [viewingApi, setViewingApi] = useState<ApiMeta | null>(null)

  const pollTimerRef = useRef<any>(null)

  // 获取汇总数据
  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/docs/summary')
      const json = await res.json()
      if (json.status === 'success') {
        setSummary(json.data)
      }
    } catch (e) {
      console.error('Failed to fetch doc summary', e)
    }
  }

  // 轮询同步状态
  const pollStatus = async () => {
    try {
      const res = await fetch('/api/docs/sync/status')
      const json = await res.json()
      if (json.status === 'success') {
        const s: DocSyncStatus = json.data
        setSyncStatus(s)
        if (s.is_running) {
          pollTimerRef.current = setTimeout(pollStatus, 800)
        } else {
          fetchSummary()
        }
      }
    } catch (e) {
      console.error('Failed to poll sync status', e)
    }
  }

  useEffect(() => {
    fetchSummary()
    pollStatus()
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  // 发起全量同步（force = true 为覆盖重拉）
  const handleStartBatchSync = async (
    force: boolean = false,
    targetIds?: string[],
    modeToUse: 'auto' | 'html' | 'api' = syncMode
  ) => {
    try {
      const body: any = { force, mode: modeToUse }
      if (targetIds && targetIds.length > 0) {
        body.api_ids = targetIds
      }
      const res = await fetch('/api/docs/sync/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.status === 'success') {
        const modeLabel = modeToUse === 'html' ? '静态网页 HTML' : modeToUse === 'api' ? '动态接口 API' : '智能混合'
        showToast({
          type: 'info',
          message: targetIds
            ? `已启动对所选 ${targetIds.length} 项接口的异步同步任务 [${modeLabel}]`
            : force
            ? `已启动全量覆盖批量同步任务 [${modeLabel}]`
            : `已启动增量批量同步任务 [${modeLabel}]`,
        })
        pollStatus()
      }
    } catch (e: any) {
      showToast({ type: 'warning', message: `启动同步失败: ${e.message}` })
    }
  }

  // 取消批量同步
  const handleCancelBatchSync = async () => {
    try {
      await fetch('/api/docs/sync/cancel', { method: 'POST' })
      showToast({ type: 'info', message: '已请求取消同步' })
      pollStatus()
    } catch (e: any) {
      console.error('Failed to cancel sync', e)
    }
  }

  // 在线同步官方目录树 (动态抓取 1519 hydration data)
  const handleSyncTree = async () => {
    setIsSyncingTree(true)
    try {
      const res = await fetch('/api/docs/tree/sync', { method: 'POST' })
      const json = await res.json()
      if (json.status === 'success') {
        const info = json.data
        showToast({
          type: 'success',
          message: `已从腾讯云官网动态提取最新目录树！共 ${info.total_apis} 项接口已热重载生效`,
        })
        await fetchApis()
        await fetchSummary()
      } else {
        showToast({ type: 'warning', message: json.detail || '同步目录树失败' })
      }
    } catch (e: any) {
      showToast({ type: 'warning', message: `同步目录树异常: ${e.message}` })
    } finally {
      setIsSyncingTree(false)
    }
  }

  // 单接口即时同步
  const handleSingleSync = async (
    e: React.MouseEvent,
    targetApi: ApiMeta,
    modeToUse: 'auto' | 'html' | 'api' = syncMode
  ) => {
    e.stopPropagation()
    setSyncingApiId(targetApi.api_id)
    try {
      const res = await fetch(`/api/docs/sync/${targetApi.api_id}?mode=${modeToUse}`, { method: 'POST' })
      const json = await res.json()
      if (json.status === 'success') {
        const srcLabel = json.data?.source_mode === 'html' ? '静态网页 HTML' : '动态接口 API'
        showToast({
          type: 'success',
          message: `接口「${targetApi.name}」文档已通过【${srcLabel}】同步成功！`,
        })
        fetchSummary()
      } else {
        showToast({ type: 'warning', message: json.detail || '同步遇到问题' })
      }
    } catch (e: any) {
      showToast({ type: 'warning', message: `同步异常: ${e.message}` })
    } finally {
      setSyncingApiId(null)
    }
  }

  // 前往调试该接口 (支持载入示例数据)
  const handleGoToDebug = (targetApi: ApiMeta, example?: any) => {
    let exampleData: any = null
    let exampleJsonText: string = ''
    if (example) {
      const raw = example.clean_json || example.content
      try {
        const parsed = JSON.parse(raw)
        exampleData = { ...parsed }
        if (!exampleData.Text && parsed.MsgBody?.[0]?.MsgContent?.Text) {
          exampleData.Text = parsed.MsgBody[0].MsgContent.Text
        }
        exampleJsonText = JSON.stringify(parsed, null, 2)
      } catch {
        exampleJsonText = raw
      }
    }

    if (exampleData) {
      openTab(targetApi, {
        formData: exampleData,
        jsonText: exampleJsonText,
        jsonError: null,
        isModified: true,
        requestTab: 'body',
      })
      showToast({
        type: 'success',
        message: `已载入示例「${example.title}」至请求体，已就绪可直接调试`,
      })
    } else {
      openTab(targetApi)
    }

    onNavigateToSandbox?.(targetApi)
  }

  // 一级分类提取与计数
  const level1Categories = useMemo(() => {
    const map = new Map<string, number>()
    apis.forEach((a) => {
      const c = a.category || '其它'
      map.set(c, (map.get(c) || 0) + 1)
    })
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
  }, [apis])

  // 当前所选一级分类下的二级分类列表与计数
  const level2Categories = useMemo(() => {
    if (selectedLevel1 === 'all') return []
    const map = new Map<string, number>()
    apis.forEach((a) => {
      if (a.category === selectedLevel1) {
        const sub = a.path && a.path.length > 1 ? a.path[1] : a.subcategory || a.category
        map.set(sub, (map.get(sub) || 0) + 1)
      }
    })
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
  }, [apis, selectedLevel1])

  // 当前所选二级分类下的三级分类列表与计数 (若存在)
  const level3Categories = useMemo(() => {
    if (selectedLevel1 === 'all' || selectedLevel2 === 'all') return []
    const map = new Map<string, number>()
    apis.forEach((a) => {
      if (a.category === selectedLevel1) {
        const sub = a.path && a.path.length > 1 ? a.path[1] : a.subcategory || a.category
        if (sub === selectedLevel2 && a.path && a.path.length > 2) {
          const sub3 = a.path[2]
          map.set(sub3, (map.get(sub3) || 0) + 1)
        }
      }
    })
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
  }, [apis, selectedLevel1, selectedLevel2])

  const handleSelectLevel1 = (cat: string) => {
    setSelectedLevel1(cat)
    setSelectedLevel2('all')
    setSelectedLevel3('all')
  }

  const handleSelectLevel2 = (sub: string) => {
    setSelectedLevel2(sub)
    setSelectedLevel3('all')
  }

  // 建立完整的一/二/三级树形分类层级体系
  const categoryHierarchy = useMemo(() => {
    const tree = new Map<
      string,
      { count: number; subcategories: Map<string, { count: number; subcategories3: Map<string, number> }> }
    >()

    apis.forEach((a) => {
      const l1 = a.category || (a.path && a.path[0]) || '其它'
      const l2 = a.path && a.path.length > 1 ? a.path[1] : a.subcategory || null
      const l3 = a.path && a.path.length > 2 ? a.path[2] : null

      if (!tree.has(l1)) {
        tree.set(l1, { count: 0, subcategories: new Map() })
      }
      const node1 = tree.get(l1)!
      node1.count += 1

      if (l2) {
        if (!node1.subcategories.has(l2)) {
          node1.subcategories.set(l2, { count: 0, subcategories3: new Map() })
        }
        const node2 = node1.subcategories.get(l2)!
        node2.count += 1

        if (l3) {
          node2.subcategories3.set(l3, (node2.subcategories3.get(l3) || 0) + 1)
        }
      }
    })

    const options: Array<{
      id: string
      displayLabel: string
      indentPrefix: string
      level: 1 | 2 | 3
      level1: string
      level2?: string
      level3?: string
      count: number
    }> = []

    Array.from(tree.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
      .forEach(([l1, data1]) => {
        options.push({
          id: `L1:${l1}`,
          displayLabel: `${l1} (${data1.count})`,
          indentPrefix: '',
          level: 1,
          level1: l1,
          count: data1.count,
        })

        Array.from(data1.subcategories.entries())
          .sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
          .forEach(([l2, data2]) => {
            options.push({
              id: `L2:${l1}/${l2}`,
              displayLabel: `↳ ${l2} (${data2.count})`,
              indentPrefix: '\u00A0\u00A0',
              level: 2,
              level1: l1,
              level2: l2,
              count: data2.count,
            })

            Array.from(data2.subcategories3.entries())
              .sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
              .forEach(([l3, count3]) => {
                options.push({
                  id: `L3:${l1}/${l2}/${l3}`,
                  displayLabel: `↳ ↳ ${l3} (${count3})`,
                  indentPrefix: '\u00A0\u00A0\u00A0\u00A0',
                  level: 3,
                  level1: l1,
                  level2: l2,
                  level3: l3,
                  count: count3,
                })
              })
          })
      })

    return { tree, options }
  }, [apis])

  // 筛选接口列表
  const filteredApis = useMemo(() => {
    return apis.filter((a) => {
      // 搜索词匹配
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchName = a.name.toLowerCase().includes(q)
        const matchCmd = a.command.toLowerCase().includes(q)
        const matchDocId = String(a.doc_id || '').includes(q)
        const matchCat = (a.category || '').toLowerCase().includes(q)
        const matchPath = (a.path || []).some((p) => p.toLowerCase().includes(q))
        if (!matchName && !matchCmd && !matchDocId && !matchCat && !matchPath) return false
      }

      // 一级分类匹配
      const itemL1 = a.category || (a.path && a.path[0]) || '其它'
      if (selectedLevel1 !== 'all' && itemL1 !== selectedLevel1) {
        return false
      }

      // 二级分类匹配
      if (selectedLevel2 !== 'all') {
        const sub = a.path && a.path.length > 1 ? a.path[1] : a.subcategory || a.category
        if (sub !== selectedLevel2) return false
      }

      // 三级分类匹配
      if (selectedLevel3 !== 'all') {
        const sub3 = a.path && a.path.length > 2 ? a.path[2] : null
        if (sub3 !== selectedLevel3) return false
      }

      return true
    })
  }, [apis, search, selectedLevel1, selectedLevel2, selectedLevel3])

  // 复选框全选控制
  const isAllSelected = useMemo(() => {
    if (filteredApis.length === 0) return false
    return filteredApis.every((a) => selectedApiIds.has(a.api_id))
  }, [filteredApis, selectedApiIds])

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedApiIds(new Set())
    } else {
      setSelectedApiIds(new Set(filteredApis.map((a) => a.api_id)))
    }
  }

  const handleToggleSelectOne = (e: React.MouseEvent, apiId: string) => {
    e.stopPropagation()
    const next = new Set(selectedApiIds)
    if (next.has(apiId)) {
      next.delete(apiId)
    } else {
      next.add(apiId)
    }
    setSelectedApiIds(next)
  }

  return (
    <div className="flex h-full w-full flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      {/* 顶部统一 Header (与批量调用、AI智能体高度/样式对齐: 标称 min-h-[56px] py-2.5 px-4 sm:px-6) */}
      <div className="shrink-0 px-4 sm:px-6 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3 sm:gap-4 select-none min-h-[56px]">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/80 shadow-2xs shrink-0">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                腾讯云 IM 官方 API 文档中心
              </h2>
              <Badge
                variant="outline"
                className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 font-mono text-[9px] py-0 px-1.5 shrink-0"
              >
                REST API 166 全量
              </Badge>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              自动化抓取官方原生文档，支持参数字典、多场景请求体、应答结构及错误码智能解析
            </p>
          </div>
        </div>

        {/* 全局同步按钮组 */}
        <div className="flex items-center gap-2">
          {/* 数据源模式选择器 */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-lg px-2.5 h-8 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">数据源:</span>
            <select
              value={syncMode}
              onChange={(e) => setSyncMode(e.target.value as any)}
              className="bg-transparent text-slate-800 dark:text-slate-200 outline-none cursor-pointer font-semibold"
              title="切换数据源抓取方式：动态接口极速拉取；静态网页直接抓取原生 HTML（防频控限制）"
            >
              <option value="auto" className="dark:bg-slate-800">智能混合</option>
              <option value="html" className="dark:bg-slate-800">静态网页 (HTML)</option>
              <option value="api" className="dark:bg-slate-800">动态接口 (API)</option>
            </select>
          </div>

          {syncStatus?.is_running ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelBatchSync}
              className="h-8 text-xs border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-semibold cursor-pointer"
            >
              终止同步任务
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncTree}
                disabled={isSyncingTree}
                className="h-8 text-xs border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-semibold gap-1.5 shadow-2xs cursor-pointer"
                title="实时抓取腾讯云 1519 页面 window.__staticRouterHydrationData，热重载并同步全部目录树"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncingTree ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncingTree ? '抓取中...' : '同步目录树'}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStartBatchSync(false, undefined, syncMode)}
                className="h-8 text-xs border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium gap-1.5 shadow-2xs cursor-pointer"
                title="仅同步本地尚未下载的文档"
              >
                <RefreshCw className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                <span>增量同步</span>
              </Button>
              <Button
                size="sm"
                onClick={() => handleStartBatchSync(true, undefined, syncMode)}
                className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold gap-1.5 shadow-xs cursor-pointer"
                title="重新并发抓取全量 166 个接口的官方最新文档并结构化存储"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                <span>全量覆盖同步</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 指标卡片与实时同步进度区域 */}
      <div className="shrink-0 px-4 sm:px-6 py-2.5 bg-slate-50/70 dark:bg-slate-950/70 border-b border-slate-200/60 dark:border-slate-800/60 space-y-2.5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">REST API 总数</span>
            <div className="flex items-baseline gap-1 font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
              <span>{summary?.total_apis || 166}</span>
              <span className="text-[10px] text-slate-400 font-normal">个接口</span>
            </div>
          </div>

          <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">已结构化同步</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {summary?.synced_count || 0}
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.2 rounded font-mono font-semibold border border-emerald-200 dark:border-emerald-800">
                {summary?.synced_percent || 0}% 覆盖
              </span>
            </div>
          </div>

          <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">全量同步时间</span>
            <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
              {summary?.last_sync_time ? summary.last_sync_time.slice(0, 16) : '—'}
            </span>
          </div>

          <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">同步引擎状态</span>
            <div className="flex items-center gap-1.5">
              {syncStatus?.is_running ? (
                <>
                  <RefreshCw className="h-3 w-3 text-blue-600 dark:text-blue-400 animate-spin" />
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                    同步中 ({syncStatus.completed}/{syncStatus.total})
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">本地就绪</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 实时同步进度条 (仅在运行中展示) */}
        {syncStatus?.is_running && (
          <div className="space-y-1.5 p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
                <span>正在抓取并结构化解析: {syncStatus.current_name}</span>
              </span>
              <span className="font-mono font-bold text-blue-800 dark:text-blue-300">
                {syncStatus.completed} / {syncStatus.total} ({syncStatus.percent}%)
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-blue-200/80 dark:bg-blue-900 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 rounded-full"
                style={{ width: `${syncStatus.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 筛选与批量操作工具栏 */}
      <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* 搜索框 */}
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索接口名、Command 或 Doc ID..."
              className="pl-8 pr-7 h-8 text-xs bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-900 dark:text-slate-100 focus-visible:ring-blue-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 分类筛选：树形层级选择器 */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={
                selectedLevel3 !== 'all'
                  ? `L3:${selectedLevel1}/${selectedLevel2}/${selectedLevel3}`
                  : selectedLevel2 !== 'all'
                  ? `L2:${selectedLevel1}/${selectedLevel2}`
                  : selectedLevel1 !== 'all'
                  ? `L1:${selectedLevel1}`
                  : 'all'
              }
              onChange={(e) => {
                const val = e.target.value
                if (val === 'all') {
                  setSelectedLevel1('all')
                  setSelectedLevel2('all')
                  setSelectedLevel3('all')
                } else {
                  const match = categoryHierarchy.options.find((o) => o.id === val)
                  if (match) {
                    setSelectedLevel1(match.level1)
                    setSelectedLevel2(match.level2 || 'all')
                    setSelectedLevel3(match.level3 || 'all')
                  }
                }
              }}
              className="h-8 text-xs rounded-lg border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-850 px-2.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-medium max-w-[270px]"
              title="选择任意层级分类进行筛选（支持一、二、三级联动）"
            >
              <option value="all" className="dark:bg-slate-800">全部分类层级 ({apis.length})</option>
              {categoryHierarchy.options.map((opt) => (
                <option
                  key={opt.id}
                  value={opt.id}
                  className={
                    opt.level === 1
                      ? 'font-bold text-slate-900 dark:text-slate-100 bg-slate-100/60 dark:bg-slate-850'
                      : opt.level === 2
                      ? 'text-slate-700 dark:text-slate-300 font-medium dark:bg-slate-800'
                      : 'text-slate-500 dark:text-slate-400 dark:bg-slate-800'
                  }
                >
                  {opt.level === 1 ? `📁 ${opt.displayLabel}` : `${opt.indentPrefix}${opt.displayLabel}`}
                </option>
              ))}
            </select>
          </div>

          {/* 当前选中的分类面包屑导航 */}
          {selectedLevel1 !== 'all' && (
            <div className="flex items-center gap-1.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 px-2.5 py-1 rounded-lg text-xs animate-in fade-in">
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">当前层级:</span>
              <button
                onClick={() => {
                  setSelectedLevel2('all')
                  setSelectedLevel3('all')
                }}
                className={`font-semibold hover:underline cursor-pointer ${
                  selectedLevel2 === 'all' ? 'text-blue-950 dark:text-blue-200 font-bold' : 'text-blue-700 dark:text-blue-400'
                }`}
                title="返回此一级分类"
              >
                {selectedLevel1}
              </button>
              {selectedLevel2 !== 'all' && (
                <>
                  <ChevronRight className="h-3 w-3 text-blue-400" />
                  <button
                    onClick={() => setSelectedLevel3('all')}
                    className={`font-semibold hover:underline cursor-pointer ${
                      selectedLevel3 === 'all' ? 'text-blue-950 dark:text-blue-200 font-bold' : 'text-blue-700 dark:text-blue-400'
                    }`}
                    title="返回此二级分类"
                  >
                    {selectedLevel2}
                  </button>
                </>
              )}
              {selectedLevel3 !== 'all' && (
                <>
                  <ChevronRight className="h-3 w-3 text-blue-400" />
                  <span className="font-bold text-blue-950 dark:text-blue-200">{selectedLevel3}</span>
                </>
              )}
              <button
                onClick={() => {
                  setSelectedLevel1('all')
                  setSelectedLevel2('all')
                  setSelectedLevel3('all')
                }}
                className="ml-1 p-0.5 rounded text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer"
                title="清除所有分类筛选"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* 勾选批量操作按钮 */}
        {selectedApiIds.size > 0 && (
          <div className="flex items-center gap-2 bg-blue-50/80 dark:bg-blue-950/40 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800">
            <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
              已选 {selectedApiIds.size} 项
            </span>
            <Button
              size="sm"
              onClick={() => handleStartBatchSync(true, Array.from(selectedApiIds), syncMode)}
              className="h-6 text-[11px] bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer"
            >
              批量同步所选
            </Button>
            <button
              onClick={() => setSelectedApiIds(new Set())}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              取消勾选
            </button>
          </div>
        )}
      </div>

      {/* 二级/三级子分类快捷标签栏 (Pill Chips) */}
      {selectedLevel1 !== 'all' && level2Categories.length > 0 && (
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0 font-medium flex items-center gap-1">
            <FolderOpen className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
            <span>{selectedLevel1}:</span>
          </span>
          <button
            onClick={() => handleSelectLevel2('all')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
              selectedLevel2 === 'all'
                ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                : 'bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            全部 ({apis.filter((a) => a.category === selectedLevel1).length})
          </button>
          {level2Categories.map((sub) => (
            <button
              key={sub.name}
              onClick={() => handleSelectLevel2(sub.name)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                selectedLevel2 === sub.name
                  ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                  : 'bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {sub.name} ({sub.count})
            </button>
          ))}
          {selectedLevel2 !== 'all' && level3Categories.length > 0 && (
            <>
              <span className="text-slate-300 dark:text-slate-700 mx-1">|</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{selectedLevel2}三级:</span>
              <button
                onClick={() => setSelectedLevel3('all')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                  selectedLevel3 === 'all'
                    ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                全部
              </button>
              {level3Categories.map((sub3) => (
                <button
                  key={sub3.name}
                  onClick={() => setSelectedLevel3(sub3.name)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                    selectedLevel3 === sub3.name
                      ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {sub3.name} ({sub3.count})
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* 接口文档主列表 (Table) */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold select-none">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-3 w-64">接口名称 / Doc ID</th>
                <th className="py-2.5 px-3 w-48">所属分类层级</th>
                <th className="py-2.5 px-3">请求 Command</th>
                <th className="py-2.5 px-3 w-28 text-center">官方文档</th>
                <th className="py-2.5 px-3 w-28 text-center">状态</th>
                <th className="py-2.5 px-3 w-48 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
              {filteredApis.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    未找到匹配的 REST API
                  </td>
                </tr>
              ) : (
                filteredApis.map((item) => {
                  const isSelected = selectedApiIds.has(item.api_id)
                  const isSyncingThis = syncingApiId === item.api_id

                  return (
                    <tr
                      key={item.api_id}
                      onClick={() => setViewingApi(item)}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-850/60 transition-colors cursor-pointer group ${
                        isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-2.5 px-3 text-center"
                        onClick={(e) => handleToggleSelectOne(e, item.api_id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* 接口名称 */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-500/10 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-200/80 dark:border-orange-500/30 shrink-0">
                            POST
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                            {item.name}
                          </span>
                          {item.doc_id && (
                            <span className="font-mono text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                              #{item.doc_id}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 分类层级 (可点击的面包屑) */}
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 flex-wrap text-[11px]">
                          {(item.path && item.path.length > 0
                            ? item.path
                            : [item.category, item.subcategory].filter(Boolean)
                          ).map((seg: string, idx: number, arr: string[]) => (
                            <React.Fragment key={idx}>
                              {idx > 0 && <span className="text-slate-300 dark:text-slate-600">/</span>}
                              <button
                                onClick={() => {
                                  if (idx === 0) {
                                    handleSelectLevel1(seg)
                                  } else if (idx === 1) {
                                    handleSelectLevel1(arr[0])
                                    handleSelectLevel2(seg)
                                  } else if (idx === 2) {
                                    handleSelectLevel1(arr[0])
                                    handleSelectLevel2(arr[1])
                                    setSelectedLevel3(seg)
                                  }
                                }}
                                className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer text-slate-600 dark:text-slate-300 hover:font-semibold transition-colors"
                                title={`筛选「${seg}」`}
                              >
                                {seg}
                              </button>
                            </React.Fragment>
                          ))}
                        </div>
                      </td>

                      {/* 请求 Command */}
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300 truncate">
                        {item.command.startsWith('v4/')
                          ? item.command
                          : `v4/${item.service_name}/${item.command}`}
                      </td>

                      {/* 腾讯云原生链接 */}
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {item.doc_url ? (
                          <a
                            href={item.doc_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-medium"
                            title="查阅腾讯云官网文档"
                          >
                            <span>查阅</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* 状态徽标 */}
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[10px] px-1.5 py-0"
                        >
                          已同步
                        </Badge>
                      </td>

                      {/* 操作列 */}
                      <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 查看完整文档抽屉 */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingApi(item)}
                            className="h-6 px-2 text-[11px] text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 font-medium"
                          >
                            查看文档
                          </Button>

                          {/* 单接口重新同步 */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleSingleSync(e, item, syncMode)}
                            disabled={isSyncingThis}
                            className="h-6 px-1.5 text-[11px] text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                            title="根据所选模式重新抓取腾讯云最新官方文档并解析"
                          >
                            <RefreshCw
                              className={`h-3 w-3 ${isSyncingThis ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`}
                            />
                          </Button>

                          {/* 前往调试 */}
                          <Button
                            size="sm"
                            onClick={() => handleGoToDebug(item)}
                            className="h-6 px-2 text-[11px] bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-medium gap-1"
                            title="切至接口调试工作台直接发起测试调用"
                          >
                            <span>调试</span>
                            <ArrowRight className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 独立完整文档查看抽屉 (Side Drawer) */}
      {viewingApi && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className={`h-full bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-200 ${
              isDrawerMaximized ? 'w-full' : 'w-full max-w-4xl xl:max-w-5xl'
            }`}
          >
            {/* 抽屉头部 */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80">
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                  {viewingApi.name} - 结构化官方文档
                </h3>
                <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 shrink-0 hidden sm:inline">
                  {viewingApi.command}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    handleGoToDebug(viewingApi)
                    setViewingApi(null)
                    setIsDrawerMaximized(false)
                  }}
                  className="h-7 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold gap-1"
                >
                  <span>前往调试</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
                <button
                  onClick={() => {
                    setViewingApi(null)
                    setIsDrawerMaximized(false)
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                  title="关闭抽屉"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 抽屉文档主体内容 */}
            <div className="flex-1 overflow-y-auto p-5 bg-white dark:bg-slate-900">
              <ApiDocsViewer
                api={viewingApi}
                onApplyExample={(ex) => {
                  handleGoToDebug(viewingApi, ex)
                  setViewingApi(null)
                  setIsDrawerMaximized(false)
                }}
                onToggleExpand={() => setIsDrawerMaximized(!isDrawerMaximized)}
                isExpanded={isDrawerMaximized}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
