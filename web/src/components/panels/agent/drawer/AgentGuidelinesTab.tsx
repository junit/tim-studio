import React from 'react'
import { Trash2 } from 'lucide-react'
import { LearnedGuideline } from './types'

interface AgentGuidelinesTabProps {
  guidelines: LearnedGuideline[]
  onDeleteGuideline: (id: string) => void
}

export const AgentGuidelinesTab: React.FC<AgentGuidelinesTabProps> = ({
  guidelines,
  onDeleteGuideline,
}) => {
  return (
    <div className="space-y-3">
      <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
        💡 <strong>自主沉淀无感准则</strong>：在日常交流中，智能体会自主理解您的管理习惯与业务要求，并在后台自动调用 <code>enhance_self_prompt</code> 增强准则库。无需打扰用户，即可持久生效。
      </div>

      {(!guidelines || guidelines.length === 0) ? (
        <div className="text-center py-8 text-slate-400 text-xs">
          暂无沉淀的强化准则。<br />
          可在日常对话中直接吩咐要求，它将自动提炼并固化为专属准则。
        </div>
      ) : (
        guidelines.map((g: LearnedGuideline, idx: number) => (
          <div
            key={g.id || idx}
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs relative group"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                准则 #{idx + 1}
              </span>
              <button
                onClick={() => onDeleteGuideline(g.id)}
                className="text-slate-400 hover:text-rose-500 p-0.5 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                title="删除该准则"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px] mb-1.5">
              {g.instruction}
            </p>
            {g.reason && (
              <div className="text-[10px] text-slate-400 italic">
                💡 触发原因: {g.reason}
              </div>
            )}
            {g.created_at && (
              <div className="text-[9px] text-slate-400 mt-1 font-mono">
                🕒 {g.created_at.slice(0, 19).replace('T', ' ')}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
