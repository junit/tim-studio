import React, { useState, useRef } from 'react'
import { DndContext, useDroppable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { Upload, FileSpreadsheet, Sparkles, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBatchStore } from '@/stores/batchStore'

interface DropzoneProps {
  onFileUploaded?: (data: any) => void
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFileUploaded }) => {
  const { setItems, addLog, fileName, items } = useBatchStore()
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { setNodeRef } = useDroppable({
    id: 'batch-file-dropzone',
  })

  const uploadFile = async (file: File) => {
    setIsUploading(true)
    addLog('INFO', `正在上传解析文件: ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/batch/upload', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (json.status === 'success') {
        setItems(json.rows, json.filename)
        addLog(
          'SUCCESS',
          `成功解析 ${json.filename}，共识别 ${json.total_rows} 行数据，字段列: [${json.columns.join(
            ', '
          )}]`
        )
        if (onFileUploaded) onFileUploaded(json)
      } else {
        alert(json.message || '上传文件解析失败')
        addLog('FAILED', '解析失败: ' + (json.message || '未知错误'))
      }
    } catch (e: any) {
      alert('上传请求异常: ' + e.message)
      addLog('FAILED', '上传异常: ' + e.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0])
    }
  }

  return (
    <DndContext>
      <div
        ref={setNodeRef}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 shadow-lg shadow-blue-500/10 scale-[1.005]'
            : fileName
            ? 'border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50'
            : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/20 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-blue-500 dark:hover:bg-slate-800/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.json"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              uploadFile(e.target.files[0])
            }
          }}
        />

        <motion.div
          animate={{ scale: isDragOver ? 1.1 : 1 }}
          transition={{ duration: 0.15 }}
          className={`flex h-12 w-12 items-center justify-center rounded-2xl mb-2.5 transition-colors ${
            fileName
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
              : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-400 dark:group-hover:bg-blue-900/40'
          }`}
        >
          {fileName ? (
            <FileSpreadsheet className="h-6 w-6" />
          ) : (
            <Upload className="h-6 w-6" />
          )}
        </motion.div>

        {fileName ? (
          <div>
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>当前已载入: {fileName}</span>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              总计有效数据: {items.length} 条记录 · 点击此处可重新选取或拖放新文件替换
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {isUploading ? '正在极速解析文件中...' : '拖放 Excel (.xlsx/.xls) / CSV / JSON 文件到此处'}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              支持一键智能解析列名与数据，或点击直接浏览本地文件
            </p>
          </div>
        )}
      </div>
    </DndContext>
  )
}
