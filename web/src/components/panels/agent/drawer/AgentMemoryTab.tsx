import React from 'react'
import { Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MemoryItem } from './types'

interface AgentMemoryTabProps {
  memories: MemoryItem[]
  onDeleteMemory: (key: string) => void
}

export const AgentMemoryTab: React.FC<AgentMemoryTabProps> = ({
  memories,
  onDeleteMemory,
}) => {
  return (
    <div className="space-y-3">
      <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-800 dark:text-indigo-300 leading-relaxed">
        🧠 <strong>长期事实记忆 (Memory)</strong>：智能体会自动从对话中提炼出关键业务实体（测试群 ID、特定账号、环境地址等），自主在后台调用 <code>save_memory</code> 记录。跨会话永久有效。
      </div>

      {(!memories || memories.length === 0) ? (
        <div className="text-center py-8 text-slate-400 text-xs">
          暂无长期记忆。<br />
          在对话中告知特定群 ID 或参数，它会自主记下。
        </div>
      ) : (
        memories.map((m: MemoryItem) => (
          <div
            key={m.key}
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs relative group"
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <Badge variant="outline" className="font-mono text-[10px] text-indigo-600 border-indigo-200 dark:border-indigo-800">
                {m.key}
              </Badge>
              <button
                type="button"
                onClick={() => onDeleteMemory(m.key)}
                className="text-slate-400 hover:text-rose-500 p-0.5 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                title="删除记忆"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed break-all">
              {m.content}
            </p>
            {m.updated_at && (
              <div className="text-[9px] text-slate-400 mt-1.5 font-mono">
                🕒 {m.updated_at.slice(0, 19).replace('T', ' ')}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
