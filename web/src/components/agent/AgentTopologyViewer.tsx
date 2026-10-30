import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  GitFork,
  Share2,
  ArrowRight,
  Bot,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Layers,
  Activity,
  X,
  ChevronRight,
  ChevronDown,
  Info,
  Zap,
  Play
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface OrchestrationEvent {
  caller_bot_id: string
  caller_bot_name?: string
  target_bot_id: string
  target_bot_name?: string
  target_avatar?: string
  task: string
  status: 'running' | 'success' | 'error' | 'ready'
  result_preview?: string
  elapsed_seconds?: number
  timestamp?: string
}

export interface TopologyNode {
  id: string
  name: string
  avatar: string
  description?: string
  skills_count?: number
  runs_count?: number
  is_default?: boolean
}

export interface TopologyLink {
  source: string
  target: string
  source_name: string
  target_name: string
  calls_count: number
  last_task: string
  last_status: string
  last_timestamp?: string
  elapsed_seconds?: number
}

export interface TopologyData {
  nodes: TopologyNode[]
  links: TopologyLink[]
  recent_events?: OrchestrationEvent[]
}

interface AgentTopologyViewerProps {
  /** 模式: 'inline' (消息卡片就地展示) | 'full' (完整交互网络视图) | 'modal' (弹窗浮层) */
  mode?: 'inline' | 'full' | 'modal'
  /** 行内模式传入的协同记录列表 */
  orchestrations?: OrchestrationEvent[]
  /** 弹窗模式控制 */
  isOpen?: boolean
  onClose?: () => void
  /** 点击某个节点切换智能体回调 */
  onSelectBot?: (botId: string) => void
  /** 当前选中的智能体 ID */
  activeBotId?: string
}

export const AgentTopologyViewer: React.FC<AgentTopologyViewerProps> = ({
  mode = 'inline',
  orchestrations = [],
  isOpen = true,
  onClose,
  onSelectBot,
  activeBotId,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0)
  const [topologyData, setTopologyData] = useState<TopologyData | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null)
  const [hoveredLink, setHoveredLink] = useState<TopologyLink | null>(null)
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark')
    }
    return false
  })

  // 监听主题变化以动态更新 SVG 和画布配色
  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    checkTheme()
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // 获取全局拓扑结构
  const fetchTopology = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/agent/topology')
      if (res.ok) {
        const data = await res.json()
        setTopologyData(data)
      }
    } catch (e) {
      console.error('Failed to fetch topology:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (mode === 'full' || mode === 'modal') {
      fetchTopology()
    }
  }, [mode, isOpen])

  // -------------------------------------------------------------
  // 1. 行内协同链路展示 (Inline Message Card)
  // -------------------------------------------------------------
  if (mode === 'inline') {
    if (!orchestrations || orchestrations.length === 0) return null

    return (
      <div className="my-2.5 rounded-xl border border-sky-200/90 dark:border-sky-800/80 bg-linear-to-br from-sky-50/70 via-indigo-50/40 to-white dark:from-[#0c1427] dark:via-[#0e172a] dark:to-[#0b101e] shadow-2xs overflow-hidden">
        {/* 卡片头部 */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-sky-100 dark:border-sky-900/60 bg-sky-100/50 dark:bg-sky-950/40 select-none">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
            </span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-900 dark:text-sky-200">
              <GitFork className="h-3.5 w-3.5 text-sky-500" />
              <span>多智能体协同流水</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300">
                {orchestrations.length} 次调度
              </Badge>
            </div>
          </div>
          <span className="text-[11px] text-sky-600/80 dark:text-sky-400/80 font-mono flex items-center gap-1">
            <Activity className="h-3 w-3" />
            分布式协同已闭环
          </span>
        </div>

        {/* 协同流水步骤列表 */}
        <div className="p-3 space-y-2.5">
          {orchestrations.map((orch, idx) => {
            const isExpanded = expandedIndex === idx
            const isSuccess = orch.status === 'success' || orch.status === 'ready'
            const isRunning = orch.status === 'running'

            return (
              <div
                key={idx}
                className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-2xs overflow-hidden transition-all duration-200"
              >
                {/* 节点流向指示栏 */}
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors select-none"
                >
                  <div className="flex items-center gap-2 text-xs min-w-0">
                    {/* 调用方 */}
                    <div className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                      <span className="text-sm">🤖</span>
                      <span className="truncate max-w-[100px]">{orch.caller_bot_name || '主控助手'}</span>
                    </div>

                    {/* 动态脉冲箭头 */}
                    <div className="flex items-center gap-1 px-1.5 text-sky-500 shrink-0">
                      <div className="h-px w-3 bg-sky-400 dark:bg-sky-500"></div>
                      <ArrowRight className="h-3.5 w-3.5 animate-pulse" />
                    </div>

                    {/* 被调用方 */}
                    <div className="flex items-center gap-1 font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-md border border-sky-200/70 dark:border-sky-800/70">
                      <span className="text-sm">{orch.target_avatar || '🤖'}</span>
                      <span className="truncate max-w-[120px]">@{orch.target_bot_name || orch.target_bot_id}</span>
                    </div>

                    {/* 状态徽标 */}
                    {isRunning ? (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-[10px] px-1.5 py-0 h-4 flex items-center gap-0.5">
                        <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                        执行中
                      </Badge>
                    ) : isSuccess ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[10px] px-1.5 py-0 h-4 flex items-center gap-0.5">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        协同成功
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-300 text-[10px] px-1.5 py-0 h-4 flex items-center gap-0.5">
                        <AlertCircle className="h-2.5 w-2.5" />
                        异常
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                    {typeof orch.elapsed_seconds === 'number' && (
                      <span className="flex items-center gap-0.5 font-mono">
                        <Clock className="h-3 w-3" />
                        {orch.elapsed_seconds}s
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                    )}
                  </div>
                </div>

                {/* 展开的委托任务与执行反馈详情 */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 text-xs space-y-2">
                    {/* 任务描述 */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        📋 委派执行任务：
                      </span>
                      <div className="p-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 leading-relaxed font-mono text-[11px]">
                        {orch.task}
                      </div>
                    </div>

                    {/* 结论预览 */}
                    {orch.result_preview && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          🎯 协同反馈产出摘要：
                        </span>
                        <div className="p-2 rounded-md bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                          {orch.result_preview}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // 2. 全局网络拓扑图 (Full Graph / Modal)
  // -------------------------------------------------------------
  const nodes = topologyData?.nodes || []
  const links = topologyData?.links || []
  const recentEvents = topologyData?.recent_events || []

  // 计算节点圆形分布坐标
  const width = 640
  const height = 440
  const centerX = width / 2
  const centerY = height / 2

  const nodePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number; node: TopologyNode }>()
    if (nodes.length === 0) return map

    // 默认助手置于中央
    const defaultNode = nodes.find((n) => n.id === 'default_assistant') || nodes[0]
    map.set(defaultNode.id, { x: centerX, y: centerY, node: defaultNode })

    const otherNodes = nodes.filter((n) => n.id !== defaultNode.id)
    const count = otherNodes.length
    const radius = Math.min(centerX, centerY) - 80

    otherNodes.forEach((n, idx) => {
      const angle = (idx / count) * 2 * Math.PI - Math.PI / 2
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      map.set(n.id, { x, y, node: n })
    })

    return map
  }, [nodes, centerX, centerY])

  const content = (
    <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Share2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              多智能体协同网络拓扑 (Agent Orchestration Topology)
              <Badge className="bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800 text-[10px]">
                {nodes.length} 节点 · {links.length} 调度边
              </Badge>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              全息展现 TIM 智能体团队的拓扑协同架构与任务调度流向
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchTopology}
            disabled={loading}
            className="h-8 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            刷新网络
          </Button>
          {mode === 'modal' && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 主视图区：左侧 SVG 拓扑网络 + 右侧协同流向流水 */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[320px] md:min-h-[460px]">
        {/* 左侧拓扑画布 */}
        <div className="flex-1 relative flex items-center justify-center bg-radial from-slate-50 via-sky-50/30 to-indigo-50/20 dark:from-slate-900 dark:via-[#0a0f1d] dark:to-[#060a14] overflow-hidden select-none">
          {/* 背景高科技网格 */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(${isDark ? '#38bdf8' : '#0284c7'} 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
            }}
          ></div>

          {nodes.length === 0 ? (
            <div className="text-center text-slate-400 dark:text-slate-500 text-xs">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-40" />
              尚未初始化智能体节点
            </div>
          ) : (
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full max-h-[500px]">
              <defs>
                {/* 连线渐变 */}
                <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={isDark ? '#38bdf8' : '#0284c7'} stopOpacity={isDark ? 0.8 : 0.75} />
                  <stop offset="100%" stopColor={isDark ? '#818cf8' : '#6366f1'} stopOpacity={isDark ? 0.6 : 0.55} />
                </linearGradient>

                {/* 箭头标记 */}
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="22"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={isDark ? '#38bdf8' : '#0284c7'} />
                </marker>
              </defs>

              {/* 绘制拓扑连线 */}
              {links.map((link, idx) => {
                const sPos = nodePositions.get(link.source)
                const tPos = nodePositions.get(link.target)
                if (!sPos || !tPos) return null

                // 贝塞尔微弧曲线
                const dx = tPos.x - sPos.x
                const dy = tPos.y - sPos.y
                const dist = Math.sqrt(dx * dx + dy * dy)
                const cx = (sPos.x + tPos.x) / 2 - (dy / dist) * 25
                const cy = (sPos.y + tPos.y) / 2 + (dx / dist) * 25

                const pathData = `M ${sPos.x} ${sPos.y} Q ${cx} ${cy} ${tPos.x} ${tPos.y}`
                const isHovered = hoveredLink?.source === link.source && hoveredLink?.target === link.target

                return (
                  <g
                    key={idx}
                    onMouseEnter={() => setHoveredLink(link)}
                    onMouseLeave={() => setHoveredLink(null)}
                    className="cursor-pointer"
                  >
                    {/* 背景发光加粗线 */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={isHovered ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#1e293b' : '#e2e8f0')}
                      strokeWidth={isHovered ? 4 : 2}
                      strokeOpacity={isHovered ? 0.6 : 0.8}
                    />
                    {/* 主流向线 */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={isHovered ? (isDark ? '#60a5fa' : '#0284c7') : 'url(#linkGradient)'}
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      strokeDasharray={link.calls_count > 0 ? '4 2' : '2 2'}
                      markerEnd="url(#arrow)"
                    />
                    {/* 脉冲流动光点动效 */}
                    {link.calls_count > 0 && (
                      <circle r="2.5" fill={isDark ? '#38bdf8' : '#0284c7'}>
                        <animateMotion path={pathData} dur={`${Math.max(2, 6 - link.calls_count)}s`} repeatCount="indefinite" />
                      </circle>
                    )}
                  </g>
                )
              })}

              {/* 绘制智能体节点 */}
              {Array.from(nodePositions.values()).map(({ x, y, node }) => {
                const isCenter = node.id === 'default_assistant'
                const isSelected = selectedNode?.id === node.id || activeBotId === node.id

                return (
                  <g
                    key={node.id}
                    transform={`translate(${x}, ${y})`}
                    onClick={() => {
                      setSelectedNode(node)
                      if (onSelectBot) onSelectBot(node.id)
                    }}
                    className="cursor-pointer group"
                  >
                    {/* 外围脉冲光环 */}
                    {isCenter && (
                      <circle
                        r="38"
                        fill="none"
                        stroke={isDark ? '#38bdf8' : '#0284c7'}
                        strokeWidth="1.5"
                        strokeOpacity="0.4"
                        className="animate-ping"
                      />
                    )}

                    {/* 节点底座圆形 */}
                    <circle
                      r={isCenter ? 32 : 26}
                      fill={isDark ? (isCenter ? '#0f172a' : '#1e293b') : (isCenter ? '#ffffff' : '#f8fafc')}
                      stroke={isSelected ? (isDark ? '#38bdf8' : '#0284c7') : isCenter ? (isDark ? '#0284c7' : '#38bdf8') : (isDark ? '#334155' : '#cbd5e1')}
                      strokeWidth={isSelected ? 3 : 1.5}
                      className="transition-all duration-200 group-hover:scale-110 drop-shadow-sm"
                    />

                    {/* Emoji 头像 */}
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={isCenter ? '20' : '16'}
                      y="-2"
                      className="select-none pointer-events-none"
                    >
                      {node.avatar || '🤖'}
                    </text>

                    {/* 节点名称 */}
                    <text
                      textAnchor="middle"
                      y={isCenter ? 44 : 38}
                      fontSize="11"
                      fontWeight="500"
                      fill={isSelected ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#e2e8f0' : '#334155')}
                      className="select-none"
                    >
                      {node.name}
                    </text>

                    {/* 技能数徽标 */}
                    {node.skills_count && node.skills_count > 0 ? (
                      <g transform="translate(18, -18)">
                        <circle r="8" fill="#0284c7" />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="9"
                          fill="#ffffff"
                          fontWeight="bold"
                        >
                          {node.skills_count}
                        </text>
                      </g>
                    ) : null}
                  </g>
                )
              })}
            </svg>
          )}

          {/* 浮动节点/连线详情卡片 */}
          {hoveredLink && (
            <div className="absolute bottom-4 left-4 p-3 rounded-xl bg-white/95 dark:bg-slate-950/90 border border-slate-200 dark:border-sky-800/80 text-xs text-slate-700 dark:text-slate-200 shadow-xl max-w-xs backdrop-blur-md">
              <div className="flex items-center gap-2 mb-1 text-sky-600 dark:text-sky-400 font-semibold">
                <Zap className="h-3.5 w-3.5" />
                <span>协同调度链路</span>
              </div>
              <div className="text-[11px] space-y-1">
                <div>
                  <span className="text-slate-400 dark:text-slate-500">调用方:</span> {hoveredLink.source_name}
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500">受托方:</span> {hoveredLink.target_name}
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500">累计调用:</span>{' '}
                  <span className="font-mono text-sky-600 dark:text-sky-300 font-bold">{hoveredLink.calls_count} 次</span>
                </div>
                {hoveredLink.last_task && (
                  <div>
                    <span className="text-slate-400 dark:text-slate-500">最新任务:</span> {hoveredLink.last_task}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右侧协同流水与详情边栏 */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 flex flex-col overflow-y-auto">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedNode.avatar}</span>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{selectedNode.name}</h4>
                    <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400">{selectedNode.id}</span>
                  </div>
                </div>
                {onSelectBot && (
                  <Button
                    size="sm"
                    onClick={() => onSelectBot(selectedNode.id)}
                    className="h-7 text-xs bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                  >
                    切换至该 BOT
                  </Button>
                )}
              </div>

              <div className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block mb-0.5">职责定位</span>
                  <p className="leading-relaxed bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                    {selectedNode.description || '协助处理专业 IM 业务需求'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 dark:text-slate-500 text-[10px] block">专属技能数</span>
                    <span className="text-sky-600 dark:text-sky-400 font-bold text-sm">{selectedNode.skills_count || 0}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 dark:text-slate-500 text-[10px] block">累计运行任务</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">{selectedNode.runs_count || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                最新多智能体协同流水
              </h4>

              {recentEvents.length === 0 ? (
                <div className="text-center text-slate-400 dark:text-slate-500 text-xs py-10">
                  暂无协同调用历史。
                  <p className="mt-1 text-[11px]">在对话中让助手指挥其他智能体（例如“让风控官排查违规”），即可自动生成协同链路。</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentEvents.map((ev, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-xs space-y-1.5 hover:border-sky-300 dark:hover:border-sky-800 transition-colors shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          🤖 {ev.caller_bot_name || ev.caller_bot_id} → {ev.target_avatar} {ev.target_bot_name || ev.target_bot_id}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px]">{ev.timestamp || ''}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] font-mono truncate">{ev.task}</p>
                      {ev.result_preview && (
                        <p className="text-emerald-700 dark:text-emerald-400/90 text-[10px] truncate bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/50">
                          {ev.result_preview}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (mode === 'modal') {
    if (!isOpen) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/40 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-4xl max-h-[92vh] sm:max-h-[85vh] h-full sm:h-[640px] shadow-2xl rounded-2xl overflow-hidden flex flex-col">
          {content}
        </div>
      </div>
    )
  }

  return content
}
