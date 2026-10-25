import React, { useState } from 'react'
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface ApprovalData {
  approval_id: string
  api_path: string
  payload?: any
  warning?: string
  target_summary?: string
  timeout_seconds?: number
  decision?: 'approve' | 'reject' | 'timeout'
}

interface ConsentGateCardProps {
  approval: ApprovalData
  onDecide: (decision: 'approve' | 'reject') => void
  isResolving?: boolean
}

export const ConsentGateCard: React.FC<ConsentGateCardProps> = ({
  approval,
  onDecide,
  isResolving = false,
}) => {
  const [showPayload, setShowPayload] = useState<boolean>(false)
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false)

  const payloadString = approval.payload
    ? typeof approval.payload === 'string'
      ? approval.payload
      : JSON.stringify(approval.payload, null, 2)
    : '{}'

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(payloadString)
    setCopiedPayload(true)
    setTimeout(() => setCopiedPayload(false), 2000)
  }

  // 1. 已授权决议状态
  if (approval.decision === 'approve') {
    return (
      <div className="w-full my-2.5 p-3.5 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 text-xs shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>高危操作已授权执行</span>
          </div>
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200 border-emerald-300 text-[10px]">
            已批准 (Approved)
          </Badge>
        </div>
        <div className="text-[11px] text-emerald-700 dark:text-emerald-300/80 font-mono">
          API: {approval.api_path} · 目标: {approval.target_summary || '全部指定目标'}
        </div>
      </div>
    )
  }

  // 2. 已拒绝决议状态
  if (approval.decision === 'reject') {
    return (
      <div className="w-full my-2.5 p-3.5 rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30 text-xs shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-semibold">
            <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            <span>高危操作已被人工安全拦截</span>
          </div>
          <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200 border-rose-300 text-[10px]">
            已拒绝 (Rejected)
          </Badge>
        </div>
        <div className="text-[11px] text-rose-700 dark:text-rose-300/80 font-mono">
          API: {approval.api_path} · 操作已安全取消，未对腾讯云 IM 发起破坏性变更
        </div>
      </div>
    )
  }

  // 3. 超时状态
  if (approval.decision === 'timeout') {
    return (
      <div className="w-full my-2.5 p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
            <Clock className="h-4 w-4 text-slate-500" />
            <span>高危操作授权超时</span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            超时自动拦截 (Timed Out)
          </Badge>
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          API: {approval.api_path} · 超过 5 分钟未人工授权，已自动取消调用
        </div>
      </div>
    )
  }

  // 4. 挂起等待人工授权确认 (Pending Approval)
  return (
    <div className="w-full my-3 p-4 rounded-2xl border-2 border-amber-400/90 dark:border-amber-500/80 bg-gradient-to-b from-amber-50/80 to-amber-100/40 dark:from-amber-950/40 dark:to-slate-900/90 shadow-xl space-y-3.5 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* 顶部标题与门禁脉冲指示器 */}
      <div className="flex items-center justify-between border-b border-amber-200/80 dark:border-amber-800/80 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-5 w-5 animate-bounce" />
          </div>
          <div>
            <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <span>⚠️ 高危操作人机协同安全门禁 (Consent Gate)</span>
            </div>
            <div className="text-[10px] text-amber-700 dark:text-amber-400/90">
              沙箱拦截到不可逆破坏性接口调用，执行已挂起等待您的授权确认
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
          <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 text-[10px] font-semibold">
            等待人工授权
          </Badge>
        </div>
      </div>

      {/* 危险调用摘要与影响目标 */}
      <div className="space-y-2 text-xs">
        <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-950/80 border border-amber-200/60 dark:border-amber-900/60 space-y-1.5">
          <div className="flex items-start gap-2">
            <span className="text-slate-500 dark:text-slate-400 shrink-0 font-medium">请求接口:</span>
            <code className="text-rose-600 dark:text-rose-400 font-mono font-bold bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/80 break-all text-[11px]">
              {approval.api_path}
            </code>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-slate-500 dark:text-slate-400 shrink-0 font-medium">影响目标:</span>
            <span className="text-slate-900 dark:text-slate-100 font-semibold break-all">
              {approval.target_summary || '未明确目标'}
            </span>
          </div>

          {approval.warning && (
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 text-[11px] pt-0.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span>{approval.warning}</span>
            </div>
          )}
        </div>

        {/* 可折叠请求 Payload JSON 检视区 */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/50 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPayload(!showPayload)}
            className="w-full px-3 py-2 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-colors cursor-pointer select-none"
          >
            <span className="font-medium">查看待发送的 API 请求参数 (JSON Payload)</span>
            {showPayload ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showPayload && (
            <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] font-mono relative">
              <button
                type="button"
                onClick={handleCopyPayload}
                className="absolute top-2 right-2 p-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer shadow-2xs"
                title="复制参数 JSON"
              >
                {copiedPayload ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <pre className="max-h-48 overflow-auto text-slate-800 dark:text-slate-200 leading-relaxed">
                {payloadString}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* 底部授权确认操作栏 */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
        <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
          ⚡ 授权后将直接向腾讯云 IM 提交破坏性指令；拒绝后沙箱将安全中止调用并反馈给模型。
        </div>

        <div className="flex items-center gap-2 justify-end shrink-0">
          <Button
            size="sm"
            variant="outline"
            disabled={isResolving}
            onClick={() => onDecide('reject')}
            className="h-8 px-3.5 text-xs text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:border-rose-300 font-semibold cursor-pointer"
          >
            {isResolving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}
            <span>拒绝此操作 (Reject)</span>
          </Button>

          <Button
            size="sm"
            disabled={isResolving}
            onClick={() => onDecide('approve')}
            className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            {isResolving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
            <span>允许执行 (Approve)</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
