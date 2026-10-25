import React from 'react'
import {
  FolderArchive,
  Loader2,
  Sparkles,
  Archive,
  Eye,
  Download,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BotFileItem } from './types'

interface AgentFilesTabProps {
  botFiles: BotFileItem[]
  isLoadingFiles: boolean
  isCleaningFiles: boolean
  onCleanupOrphanFiles: () => void
  onExportAllFiles: () => void
  onDeleteBotFile: (filename: string) => void
  onPreviewImage: (file: { url: string; name: string }) => void
  getAttachmentIcon: (category?: string, type?: string) => React.ReactNode
}

export const AgentFilesTab: React.FC<AgentFilesTabProps> = ({
  botFiles,
  isLoadingFiles,
  isCleaningFiles,
  onCleanupOrphanFiles,
  onExportAllFiles,
  onDeleteBotFile,
  onPreviewImage,
  getAttachmentIcon,
}) => {
  return (
    <div className="space-y-3">
      <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
        📁 <strong>产出物与文件中心 (Artifact & File Hub)</strong>：当前智能体接收的所有用户附件，以及通过 Python 沙箱数据清洗、报表统计所生成的文件均持久化在此。可按需下载或一键打包导出。
      </div>

      {/* 工具操作栏 */}
      <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
          <span>共 {botFiles.length} 个文件</span>
          {isLoadingFiles && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={onCleanupOrphanFiles}
            disabled={isCleaningFiles || botFiles.length === 0}
            className="h-6 px-2 text-[10px] gap-1 cursor-pointer text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/50"
            title="扫描并清理未在历史会话中引用的废弃孤儿文件"
          >
            {isCleaningFiles ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
            <span>清理孤儿文件</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onExportAllFiles}
            disabled={botFiles.length === 0}
            className="h-6 px-2 text-[10px] gap-1 cursor-pointer text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/50"
            title="打包导出该智能体下的全部文件为 ZIP 压缩包"
          >
            <Archive className="h-2.5 w-2.5" />
            <span>打包下载 (.zip)</span>
          </Button>
        </div>
      </div>

      {/* 文件列表 */}
      {botFiles.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-xs space-y-1">
          <FolderArchive className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 stroke-[1.5]" />
          <div className="font-semibold text-slate-500">暂无任何文件</div>
          <div className="text-[11px]">上传附件或让智能体运行脚本生成报表后，将在此持久化汇聚。</div>
        </div>
      ) : (
        <div className="space-y-2">
          {botFiles.map((f) => (
            <div
              key={f.name}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center justify-between gap-2.5 group hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-100 dark:border-blue-900 flex items-center justify-center shrink-0">
                  {getAttachmentIcon(f.category, f.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5" title={f.original_name}>
                    <span>{f.original_name}</span>
                    {f.is_referenced ? (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 shrink-0">
                        会话引用
                      </span>
                    ) : (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 shrink-0">
                        未引用孤儿
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                    <span>{f.size_formatted}</span>
                    <span>·</span>
                    <span>{f.type.toUpperCase()}</span>
                    <span>·</span>
                    <span>{f.created_at?.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {f.category === 'image' && (
                  <button
                    type="button"
                    onClick={() => onPreviewImage({ url: f.url, name: f.original_name })}
                    className="p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                    title="在线预览大图"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                )}
                <a
                  href={f.url}
                  download={f.original_name}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-400 hover:text-blue-600 transition-colors"
                  title="下载原文件"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => onDeleteBotFile(f.name)}
                  className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title="彻底删除文件"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
