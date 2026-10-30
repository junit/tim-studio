import React, { useState, useMemo, useEffect } from 'react'
import {
  Code2,
  Terminal,
  Brain,
  Check,
  Copy,
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react'
import { MarkdownView } from '@/components/common/MarkdownView'
import { AgentTopologyViewer, OrchestrationEvent } from '@/components/agent/AgentTopologyViewer'

// ==========================================
// 1. 结构化输出解析器 (Structured Output Parser)
// ==========================================

export interface ParsedExecutionResult {
  raw: string
  cleanText: string
  isJson: boolean
  jsonData: any
  isTimApi: boolean
  isSuccess: boolean
  isError: boolean
  actionStatus?: string
  errorCode?: number
  errorInfo?: string
  totalCount?: number
  metrics: Array<{ label: string; value: string | number; color: 'blue' | 'emerald' | 'amber' | 'purple' | 'slate' }>
  arrayKey?: string
  arrayItems?: any[]
  isTraceback: boolean
  errorSnippet?: string
  isEmptyOutput: boolean
}

export function parseExecutionOutput(rawOutput: string): ParsedExecutionResult {
  const clean = (rawOutput || '').trim()

  const isEmptyOutput =
    !clean ||
    clean.includes('无输出') ||
    clean.includes('无标准输出') ||
    clean === 'None' ||
    clean === '```bash\n```' ||
    clean === '```bash\n\n```'

  // 1. 检查异常与 Traceback
  const isTraceback = /Traceback \(most recent call last\)|Exception:|Error:|SyntaxError:|ImportError:|NameError:|FAIL/i.test(clean)
  let errorSnippet = ''
  if (isTraceback) {
    const lines = clean.split('\n')
    const errLine = lines.find((l) => /Error:|Exception:|Traceback/i.test(l))
    if (errLine) errorSnippet = errLine.trim()
  }

  // 2. 剥离 Markdown 代码块包裹
  let unquoted = clean
  if (unquoted.startsWith('> ⚠️ **沙箱执行告警 / 异常**')) {
    unquoted = unquoted.replace(/^>\s*⚠️\s*\*\*沙箱执行告警\s*\/\s*异常\*\*\s*/i, '').trim()
  }
  if (unquoted.startsWith('```json')) {
    unquoted = unquoted.slice(7)
  } else if (unquoted.startsWith('```bash')) {
    unquoted = unquoted.slice(7)
  } else if (unquoted.startsWith('```text')) {
    unquoted = unquoted.slice(7)
  } else if (unquoted.startsWith('```')) {
    unquoted = unquoted.slice(3)
  }
  if (unquoted.endsWith('```')) {
    unquoted = unquoted.slice(0, -3)
  }
  unquoted = unquoted.trim()

  // 3. 尝试解析 JSON
  let jsonData: any = null
  let isJson = false
  if (
    (unquoted.startsWith('{') && unquoted.endsWith('}')) ||
    (unquoted.startsWith('[') && unquoted.endsWith(']'))
  ) {
    try {
      jsonData = JSON.parse(unquoted)
      isJson = true
    } catch {
      try {
        const normalized = unquoted
          .replace(/'/g, '"')
          .replace(/None/g, 'null')
          .replace(/True/g, 'true')
          .replace(/False/g, 'false')
        jsonData = JSON.parse(normalized)
        isJson = true
      } catch {
        // ignore
      }
    }
  }

  // 4. 提取 TIM 关键结构
  let isTimApi = false
  let actionStatus: string | undefined = undefined
  let errorCode: number | undefined = undefined
  let errorInfo: string | undefined = undefined
  let totalCount: number | undefined = undefined
  let isSuccess = !isTraceback
  let isError = isTraceback
  const metrics: ParsedExecutionResult['metrics'] = []
  let arrayKey: string | undefined = undefined
  let arrayItems: any[] | undefined = undefined

  if (isJson && jsonData && typeof jsonData === 'object') {
    if (!Array.isArray(jsonData)) {
      if ('ActionStatus' in jsonData || 'ErrorCode' in jsonData) {
        isTimApi = true
        actionStatus = jsonData.ActionStatus
        errorCode = typeof jsonData.ErrorCode === 'number' ? jsonData.ErrorCode : undefined
        errorInfo = jsonData.ErrorInfo

        isSuccess =
          (actionStatus === 'OK' || !actionStatus) &&
          (errorCode === 0 || errorCode === undefined)
        if (!isSuccess) {
          isError = true
          if (errorInfo) errorSnippet = errorInfo
        }
      }

      if ('TotalCount' in jsonData && typeof jsonData.TotalCount === 'number') {
        totalCount = jsonData.TotalCount
        metrics.push({ label: '记录总数', value: jsonData.TotalCount, color: 'blue' })
      }
      if ('GroupId' in jsonData && typeof jsonData.GroupId === 'string') {
        metrics.push({ label: '群组 ID', value: jsonData.GroupId, color: 'purple' })
      }
      if ('MemberList' in jsonData && Array.isArray(jsonData.MemberList)) {
        arrayKey = 'MemberList'
        arrayItems = jsonData.MemberList
        metrics.push({ label: '群成员', value: `${jsonData.MemberList.length} 人`, color: 'emerald' })
      }
      if ('GroupIdList' in jsonData && Array.isArray(jsonData.GroupIdList)) {
        arrayKey = 'GroupIdList'
        arrayItems = jsonData.GroupIdList
        metrics.push({ label: '群组数', value: `${jsonData.GroupIdList.length} 个`, color: 'emerald' })
      }
      if ('RspMsgList' in jsonData && Array.isArray(jsonData.RspMsgList)) {
        arrayKey = 'RspMsgList'
        arrayItems = jsonData.RspMsgList
        metrics.push({ label: '消息数', value: `${jsonData.RspMsgList.length} 条`, color: 'blue' })
      }
      if ('QueryResult' in jsonData && Array.isArray(jsonData.QueryResult)) {
        arrayKey = 'QueryResult'
        arrayItems = jsonData.QueryResult
        metrics.push({ label: '查询结果', value: `${jsonData.QueryResult.length} 条`, color: 'amber' })
      }
    } else {
      arrayKey = 'items'
      arrayItems = jsonData
      metrics.push({ label: '列表数量', value: `${jsonData.length} 项`, color: 'emerald' })
    }
  }

  return {
    raw: clean,
    cleanText: unquoted,
    isJson,
    jsonData,
    isTimApi,
    isSuccess,
    isError,
    actionStatus,
    errorCode,
    errorInfo,
    totalCount,
    metrics,
    arrayKey,
    arrayItems,
    isTraceback,
    errorSnippet,
    isEmptyOutput: isEmptyOutput || unquoted === '' || unquoted === 'None',
  }
}

// ==========================================
// 2. Python 脚本分析工具
// ==========================================

export function analyzePythonScript(code: string) {
  const clean = (code || '').trim()
  const lines = clean.split('\n')
  const lineCount = lines.length

  // 匹配所有泛化接口调用 (cloud_call, live_call, im_call, tim_call, 及任意 {service}_call)
  const apiMatches = Array.from(
    clean.matchAll(/(?:cloud_call|[a-zA-Z0-9_]+_call)\(\s*['"]([^'"]+)['"]/g)
  ).map((m) => m[1])
  const uniqueApis = Array.from(new Set(apiMatches))

  const toolsUsed: string[] = []
  if (clean.includes('cloud_search_apis') || clean.includes('tim_search_apis') || clean.includes('search_apis')) {
    toolsUsed.push('search_apis')
  }
  if (clean.includes('cloud_get_doc') || clean.includes('tim_get_doc') || clean.includes('get_doc')) {
    toolsUsed.push('get_doc')
  }
  if (clean.includes('save_memory')) toolsUsed.push('save_memory')
  if (clean.includes('recall_memory')) toolsUsed.push('recall_memory')
  if (clean.includes('save_skill')) toolsUsed.push('save_skill')
  if (clean.includes('run_skill')) toolsUsed.push('run_skill')

  let stepTitle = 'Python 数据推理与计算'
  if (uniqueApis.length > 0) {
    const apiBasenames = uniqueApis.map((a) => a.split('/').pop() || a)
    stepTitle = `调用 ${apiBasenames.join(', ')}`
  } else if (clean.includes('cloud_search_apis') || clean.includes('tim_search_apis') || clean.includes('search_apis')) {
    stepTitle = '检索腾讯云多业务接口'
  } else if (clean.includes('cloud_get_doc') || clean.includes('tim_get_doc') || clean.includes('get_doc')) {
    stepTitle = '查阅官方接口文档规范'
  } else if (clean.includes('save_skill')) {
    stepTitle = '沉淀并保存自动化技能'
  } else if (clean.includes('save_memory')) {
    stepTitle = '固化业务偏好至长期记忆'
  }

  return {
    lineCount,
    uniqueApis,
    toolsUsed,
    stepTitle,
  }
}

// ==========================================
// 3. 步骤与执行运行领域模型 (Message → Run → Step)
// ==========================================

export interface AgentStep {
  step: number
  status: 'running' | 'success' | 'error'
  title: string
  thoughtSummary?: string
  code?: string
  output?: string
  duration_s?: number
  error?: string
}

export interface AgentRun {
  runId?: string
  status: 'running' | 'completed' | 'failed'
  planning?: string
  steps: AgentStep[]
  verification?: string
  orchestrations?: OrchestrationEvent[]
  elapsedSeconds?: number
}

// ==========================================
// 4. 会话内嵌执行轨迹与步骤展开组件 (AgentExecutionRun)
//    核心规范：
//    1. 默认直接展开代码与结果，无需手动点击展开
//    2. 浅色/深色主题完美自适应 (浅色模式下为柔和浅灰底，深色模式下为深邃深灰底)
//    3. 原生语义化 <pre><code> 全宽自适应 (w-full)
// ==========================================

interface AgentExecutionRunProps {
  run: AgentRun
  isStreaming?: boolean
  currentStreamingStep?: number
  streamingStage?: 'thinking' | 'coding' | 'executing'
  orchestrations?: OrchestrationEvent[]
  onCopyText: (text: string, id: string) => void
  copiedId: string | null
}

export const AgentExecutionRun: React.FC<AgentExecutionRunProps> = ({
  run,
  isStreaming = false,
  currentStreamingStep = 1,
  streamingStage,
  orchestrations,
  onCopyText,
  copiedId,
}) => {
  // 第一级总览折叠状态：流式中默认展开查看过程；完成时默认收拢为概要栏，可点击随时重新展开
  const [isOverviewExpanded, setIsOverviewExpanded] = useState<boolean>(isStreaming)
  const [userToggledOverview, setUserToggledOverview] = useState<boolean>(false)

  // 第二级与第三级：各步骤的折叠控制（用户需求：默认均不收起，思考、代码与结果直接展开完整呈现）
  const [collapsedSteps, setCollapsedSteps] = useState<Record<number, boolean>>({})
  const [collapsedCodes, setCollapsedCodes] = useState<Record<number, boolean>>({})
  const [collapsedOutputs, setCollapsedOutputs] = useState<Record<number, boolean>>({})

  // 流式结束时，若用户未显式干预，平滑收拢为总览胶囊条；流式中保持展开
  useEffect(() => {
    if (!isStreaming && !userToggledOverview) {
      setIsOverviewExpanded(false)
    } else if (isStreaming && !userToggledOverview) {
      setIsOverviewExpanded(true)
    }
  }, [isStreaming, userToggledOverview])

  const toggleStep = (stepNum: number) => {
    setCollapsedSteps((prev) => ({
      ...prev,
      [stepNum]: !prev[stepNum],
    }))
  }

  const toggleCode = (stepNum: number) => {
    setCollapsedCodes((prev) => ({
      ...prev,
      [stepNum]: !prev[stepNum],
    }))
  }

  const toggleOutput = (stepNum: number) => {
    setCollapsedOutputs((prev) => ({
      ...prev,
      [stepNum]: !prev[stepNum],
    }))
  }

  const stepsCount = run.steps.length

  return (
    <div className="w-full space-y-2 select-text font-sans">
      {/* ==================================================== */}
      {/* 第一级：任务概览 (Task Overview) — 极简紧凑单行状态条 (严禁换行折叠) */}
      {/* ==================================================== */}
      <div className="w-full h-9 min-h-[36px] flex items-center justify-between px-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors border border-slate-200/70 dark:border-slate-800/70 text-xs select-none">
        <div
          onClick={() => {
            setUserToggledOverview(true)
            setIsOverviewExpanded(!isOverviewExpanded)
          }}
          className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 overflow-hidden mr-2"
        >
          {isStreaming ? (
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
            </span>
          ) : run.status === 'failed' ? (
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          )}

          <span className="font-semibold text-slate-800 dark:text-slate-100 truncate shrink-0">
            {isStreaming
              ? `正在执行第 ${currentStreamingStep || 1} 步排查...`
              : `分析执行过程 · 共 ${stepsCount} 步${run.elapsedSeconds ? ` · ${run.elapsedSeconds}s` : ''}`}
          </span>

          {/* 状态徽标 (单行紧凑) */}
          <span
            className={`hidden sm:inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium shrink-0 ${
              isStreaming
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-mono animate-pulse'
                : run.status === 'failed'
                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                : 'bg-emerald-100/70 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {isStreaming ? '执行中' : run.status === 'failed' ? '存在异常' : '全部完成'}
          </span>

          {/* 步骤轻量进度压缩显示 (单行自适应，步数多时压缩为 +N 步，绝对不换行撑高) */}
          {run.steps.length > 0 && (
            <div className="hidden md:flex items-center gap-1 ml-1 overflow-hidden shrink min-w-0">
              {run.steps.slice(0, run.steps.length > 3 ? 2 : 3).map((st) => (
                <span
                  key={st.step}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono whitespace-nowrap shrink-0 ${
                    st.status === 'running'
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 animate-pulse'
                      : st.status === 'error'
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                      : 'bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <span className="truncate max-w-[72px]">{st.step}. {st.title.split(' ')[0]}</span>
                </span>
              ))}
              {run.steps.length > (run.steps.length > 3 ? 2 : 3) && (
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-200/70 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 shrink-0">
                  +{run.steps.length - 2} 步
                </span>
              )}
            </div>
          )}
        </div>

        {/* 展开/收起切换 */}
        <button
          type="button"
          onClick={() => {
            setUserToggledOverview(true)
            setIsOverviewExpanded(!isOverviewExpanded)
          }}
          className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline shrink-0 cursor-pointer select-none"
        >
          <span>{isOverviewExpanded ? '收起详情' : '查看详情'}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              isOverviewExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* 多智能体协同流水拓扑卡片 (当该轮对话存在协同调度时展示) */}
      {((run.orchestrations && run.orchestrations.length > 0) || (orchestrations && orchestrations.length > 0)) && (
        <AgentTopologyViewer
          mode="inline"
          orchestrations={run.orchestrations || orchestrations}
        />
      )}

      {/* ==================================================== */}
      {/* 第二级与第三级：步骤详情与代码/结果 (默认直接展开展示) */}
      {/* ==================================================== */}
      {isOverviewExpanded && (
        <div className="ml-1 pl-3.5 pr-0.5 py-1 space-y-4 border-l-2 border-slate-200 dark:border-slate-800 min-w-0 max-w-full animate-in fade-in-50 duration-150">
          {/* 任务规划摘要 (如果有) */}
          {run.planning && (
            <div className="text-xs text-slate-600 dark:text-slate-300 pb-1 min-w-0 max-w-full">
              <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">
                📋 任务目标与规划
              </span>
              <div className="border-l-2 border-blue-400/60 pl-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed min-w-0 max-w-full">
                <MarkdownView content={run.planning} />
              </div>
            </div>
          )}

          {/* 步骤列表 */}
          {run.steps.map((st) => {
            const isStepExpanded = !collapsedSteps[st.step] // 默认展开！
            const isCodeExpanded = !collapsedCodes[st.step] // 代码默认直接展开！
            const isOutputExpanded = !collapsedOutputs[st.step] // 结果默认直接展开！

            const parsedOutput = st.output ? parseExecutionOutput(st.output) : null
            const analysis = st.code ? analyzePythonScript(st.code) : null

            return (
              <div
                key={st.step}
                className="w-full min-w-0 max-w-full space-y-2 pb-3 last:pb-0 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
              >
                {/* 步骤标题行 */}
                <div
                  onClick={() => toggleStep(st.step)}
                  className="flex items-center justify-between text-xs select-none cursor-pointer group py-0.5 min-w-0"
                >
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-mono font-bold shrink-0">
                      {st.step}
                    </span>

                    <span className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      第 {st.step} 步 · {st.title}
                    </span>

                    {/* 状态标 */}
                    {st.status === 'running' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded font-mono animate-pulse shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                        <span>执行中...</span>
                      </span>
                    ) : st.status === 'error' || parsedOutput?.isError ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.2 rounded font-mono font-medium shrink-0">
                        <span>执行异常</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded font-mono font-medium shrink-0">
                        <span>成功</span>
                      </span>
                    )}

                    {st.duration_s ? (
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5 shrink-0">
                        <Clock className="h-2.5 w-2.5" />
                        <span>{st.duration_s}s</span>
                      </span>
                    ) : null}
                  </div>

                  <ChevronDown
                    className={`h-3 w-3 text-slate-400 transition-transform duration-150 shrink-0 ${
                      isStepExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </div>

                {/* 步骤内容主体 */}
                {isStepExpanded && (
                  <div className="space-y-3 pl-5 text-xs min-w-0 max-w-full">
                    {/* 1. 思考说明 (Why：面向用户的行动依据与分析说明) */}
                    {st.thoughtSummary && (
                      <div className="border-l-2 border-blue-400/60 dark:border-blue-500/50 pl-3 py-0.5 text-slate-700 dark:text-slate-300 leading-relaxed font-sans min-w-0 max-w-full">
                        <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                          💭 思考说明
                        </span>
                        <MarkdownView content={st.thoughtSummary} />
                        {isStreaming && currentStreamingStep === st.step && streamingStage === 'thinking' && (
                          <span className="inline-block w-1.5 h-3.5 bg-blue-500 animate-pulse ml-0.5 align-middle rounded-xs" />
                        )}
                      </div>
                    )}

                    {/* 2. 执行代码 · Python (默认直接展开，深浅色主题自适应) */}
                    {st.code && (
                      <div className="w-full min-w-0 max-w-full space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 select-none">
                          <button
                            type="button"
                            onClick={() => toggleCode(st.step)}
                            className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                          >
                            <Code2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>执行代码 · Python {analysis ? `(${analysis.lineCount} 行)` : ''}</span>
                            <ChevronDown
                              className={`h-3 w-3 transition-transform duration-150 ${
                                isCodeExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() => onCopyText(st.code!, `code-${st.step}`)}
                            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                          >
                            {copiedId === `code-${st.step}` ? (
                              <>
                                <Check className="h-2.5 w-2.5 text-emerald-500" />
                                <span className="text-emerald-500 font-medium">已复制代码</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-2.5 w-2.5" />
                                <span>复制代码</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* 原生语义化 <pre><code>：限制 max-w-full box-border 防止水平溢出 */}
                        {isCodeExpanded && (
                          <pre className="w-full max-w-full box-border p-3 font-mono text-xs leading-relaxed overflow-x-auto rounded-lg bg-slate-50/90 dark:bg-slate-950 text-slate-800 dark:text-emerald-300 border border-slate-200/90 dark:border-slate-800 select-text whitespace-pre max-h-72 shadow-2xs">
                            <code>{st.code}</code>
                          </pre>
                        )}
                      </div>
                    )}

                    {/* 3. 执行结果 · Stdout / API 响应 (默认直接展开，深浅色主题自适应) */}
                    {st.output && (
                      <div className="w-full min-w-0 max-w-full space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 select-none">
                          <button
                            type="button"
                            onClick={() => toggleOutput(st.step)}
                            className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                          >
                            <Terminal className="h-3.5 w-3.5 text-indigo-500" />
                            <span>执行结果 · Stdout / API 响应</span>
                            <ChevronDown
                              className={`h-3 w-3 transition-transform duration-150 ${
                                isOutputExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() => onCopyText(st.output!, `output-${st.step}`)}
                            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                          >
                            {copiedId === `output-${st.step}` ? (
                              <>
                                <Check className="h-2.5 w-2.5 text-emerald-500" />
                                <span className="text-emerald-500 font-medium">已复制输出</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-2.5 w-2.5" />
                                <span>复制输出</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* 核心指标药丸横排 */}
                        {parsedOutput && parsedOutput.metrics.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 w-full min-w-0 max-w-full">
                            {parsedOutput.metrics.map((m, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-mono bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60"
                              >
                                {m.label}: <strong>{m.value}</strong>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 异常报错提示条 */}
                        {parsedOutput?.isError && parsedOutput.errorSnippet && (
                          <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/40 border-l-2 border-rose-500 text-rose-700 dark:text-rose-300 text-xs font-mono min-w-0 max-w-full">
                            ⚠️ {parsedOutput.errorSnippet}
                          </div>
                        )}

                        {/* 产物全文输出：限制 max-w-full box-border 防止水平溢出 */}
                        {isOutputExpanded && (
                          parsedOutput?.isEmptyOutput ? (
                            <div className="w-full p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                                <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span>代码执行成功（无控制台标准输出）</span>
                              </span>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                Python 脚本已在沙箱中成功运行并结算。因该步骤未显式调用 <code>print(...)</code>，控制台无文本流输出。若需在卡片中实时观测接口返回数据，可在脚本中添加 <code>print(res)</code>。
                              </p>
                            </div>
                          ) : (
                            <pre className="w-full max-w-full box-border p-3 font-mono text-xs leading-relaxed overflow-x-auto rounded-lg bg-slate-50/90 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800 select-text whitespace-pre max-h-72 shadow-2xs">
                              <code>
                                {parsedOutput?.isJson
                                  ? JSON.stringify(parsedOutput.jsonData, null, 2)
                                  : parsedOutput?.cleanText || parsedOutput?.raw || st.output}
                              </code>
                            </pre>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* 综合校验与结论归纳 (如果有) */}
          {run.verification && (
            <div className="text-xs text-slate-600 dark:text-slate-300 pt-1 min-w-0 max-w-full">
              <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">
                🔍 综合校验与分析结论
              </span>
              <div className="border-l-2 border-emerald-400/60 pl-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed min-w-0 max-w-full">
                <MarkdownView content={run.verification} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ==========================================
// 5. 步骤流构建器：将消息结构转换为标准的 AgentRun 领域模型
// ==========================================

export function buildAgentRunFromMessage(msg: {
  thought?: string
  codeBlocks?: Array<{ step: number; code: string; status?: 'running' | 'success' | 'error' }>
  executionLogs?: Array<{ step: number; output: string; status?: 'running' | 'success' | 'error' }>
  toolCalls?: Array<{ step: number; output: string }>
  metadata?: Record<string, any>
  orchestrations?: OrchestrationEvent[]
  isStreaming?: boolean
  streamStatus?: string
  currentStep?: number
  elapsedSeconds?: number
}): AgentRun {
  const fullThought = msg.thought || ''
  const orchestrations = msg.orchestrations || msg.metadata?.orchestrations || []

  // 1. 提取全局规划
  let planning: string | undefined = undefined
  const planMatch = fullThought.match(/####\s*📋\s*任务规划[^\n]*\n+([\s\S]*?)(?=(?:####\s*[💭🔍]|\n\n---\n\n|$))/i)
  if (planMatch) {
    planning = planMatch[1].trim()
  }

  // 2. 提取综合校验
  let verification: string | undefined = undefined
  const verifyMatch = fullThought.match(/####\s*🔍\s*综合校验[^\n]*\n+([\s\S]*?)$/i)
  if (verifyMatch) {
    verification = verifyMatch[1].trim()
  }

  // 3. 收集所有步骤号
  const stepNums = new Set<number>()
  if (msg.codeBlocks) {
    msg.codeBlocks.forEach((c) => stepNums.add(c.step || 1))
  }
  if (msg.executionLogs) {
    msg.executionLogs.forEach((l) => stepNums.add(l.step || 1))
  }
  if (msg.toolCalls) {
    msg.toolCalls.forEach((t) => stepNums.add(t.step || 1))
  }
  if (msg.currentStep) {
    stepNums.add(msg.currentStep)
  }

  // 匹配步骤推理
  const stepThoughtRegex = /####\s*💭\s*步骤\s*(\d+)[^\n]*\n+([\s\S]*?)(?=(?:####|\n\n---\n\n|$))/gi
  let match: RegExpExecArray | null
  const thoughtByStep: Record<number, string> = {}
  while ((match = stepThoughtRegex.exec(fullThought)) !== null) {
    const s = parseInt(match[1], 10)
    thoughtByStep[s] = match[2].trim()
    stepNums.add(s)
  }

  if (stepNums.size === 0 && (fullThought || (msg.codeBlocks && msg.codeBlocks.length > 0))) {
    stepNums.add(1)
  }

  const sortedSteps = Array.from(stepNums).sort((a, b) => a - b)
  const steps: AgentStep[] = sortedSteps.map((s) => {
    const codeItem = msg.codeBlocks?.find((c) => (c.step || 1) === s)
    const logItem =
      msg.executionLogs?.find((l) => (l.step || 1) === s) ||
      msg.toolCalls?.find((t) => (t.step || 1) === s)

    let thought = thoughtByStep[s]
    if (!thought && sortedSteps.length === 1) {
      let clean = fullThought
      if (planning) {
        clean = clean.replace(/####\s*📋\s*任务规划[^\n]*\n+[\s\S]*?(?=(?:####|\n\n---\n\n|$))/i, '').trim()
      }
      if (verification) {
        clean = clean.replace(/####\s*🔍\s*综合校验[^\n]*\n+[\s\S]*?$/i, '').trim()
      }
      thought = clean
    }

    const isError =
      codeItem?.status === 'error' ||
      (logItem as any)?.status === 'error'

    let status: 'running' | 'success' | 'error' = 'success'
    if (isError) {
      status = 'error'
    } else if (msg.isStreaming && msg.streamStatus !== 'answering') {
      const hasOutput = Boolean(logItem?.output)
      const isCurrentStep = (msg.currentStep || 1) === s
      if (!hasOutput && (isCurrentStep || codeItem?.status === 'running')) {
        status = 'running'
      } else {
        status = 'success'
      }
    } else {
      status = 'success'
    }

    const analysis = codeItem?.code ? analyzePythonScript(codeItem.code) : null
    let title = analysis?.stepTitle || `步骤 ${s} 推理分析`

    // 1. 优先提取：如果代码第一行带有中文意图注释 (例如 "# 1. 查询指定群组资料" -> "查询指定群组资料")
    if (codeItem?.code) {
      const firstComment = codeItem.code.split('\n').map((l) => l.trim()).find((l) => l.startsWith('#'))
      if (firstComment) {
        const cleanComment = firstComment.replace(/^#+\s*(\d+[.、\s]*)?/, '').trim()
        if (cleanComment && cleanComment.length >= 2 && cleanComment.length <= 26 && !cleanComment.includes('coding:')) {
          title = cleanComment
        }
      }
    }

    // 2. 目标提取：如果模型思考中含有明确的行动目标 (例如 "**目标**：分析异常订单原因")
    if (thought) {
      const goalMatch = thought.match(/(?:\*\*步骤目标\*\*|\*\*行动目标\*\*|\*\*目标\*\*|步骤目标|行动目标|目标)[：:]\s*([^\n]+)/i)
      if (goalMatch && goalMatch[1].trim()) {
        const cleanGoal = goalMatch[1].trim().replace(/^[#*\s]+|[#*\s]+$/g, '')
        if (cleanGoal.length <= 26) {
          title = cleanGoal
        }
      }
    }

    return {
      step: s,
      status,
      title,
      thoughtSummary: thought || undefined,
      code: codeItem?.code,
      output: logItem?.output,
      duration_s: undefined,
    }
  }).filter((st) => Boolean(st.thoughtSummary || st.code || st.output || st.status === 'running'))

  const isCompleted = !msg.isStreaming
  const hasError = steps.some((s) => s.status === 'error')

  return {
    status: isCompleted ? (hasError ? 'failed' : 'completed') : 'running',
    planning,
    steps,
    verification,
    orchestrations,
    elapsedSeconds: msg.elapsedSeconds,
  }
}
