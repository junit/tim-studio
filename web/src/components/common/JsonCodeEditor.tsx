import React, { useState, useMemo, useCallback } from 'react'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { Copy, Check, Sparkles, AlertCircle } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

export interface JsonCodeEditorProps {
  value: string
  onChange?: (val: string) => void
  readOnly?: boolean
  height?: string
  minHeight?: string
  maxHeight?: string
  label?: string
  placeholder?: string
  showLineNumbers?: boolean
  showToolbar?: boolean
  extraActions?: React.ReactNode
  className?: string
  error?: string | null
  hideStats?: boolean
}

// 浅色模式 CodeMirror 主题
const lightEditorTheme = EditorView.theme({
  '&': {
    fontSize: '12px',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    backgroundColor: 'transparent',
    color: '#0f172a',
  },
  '.cm-content': {
    padding: '8px 0',
    caretColor: '#f97316',
  },
  '.cm-line': {
    padding: '0 8px',
    lineHeight: '1.6',
  },
  '.cm-gutters': {
    backgroundColor: '#f8fafc',
    borderRight: '1px solid #e2e8f0',
    color: '#94a3b8',
    fontSize: '11px',
    paddingLeft: '4px',
    userSelect: 'none',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(241, 245, 249, 0.6)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#f1f5f9',
    color: '#ea580c',
    fontWeight: '600',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit',
  },
  '.cm-string': { color: '#059669' }, // emerald-600
  '.cm-number': { color: '#d97706' }, // amber-600
  '.cm-bool': { color: '#7c3aed' },   // violet-600
  '.cm-null': { color: '#64748b' },   // slate-500
  '.cm-property': { color: '#0284c7' }, // sky-600
})

// 深色模式 CodeMirror 主题
const darkEditorTheme = EditorView.theme({
  '&': {
    fontSize: '12px',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    backgroundColor: 'transparent',
    color: '#e2e8f0',
  },
  '.cm-content': {
    padding: '8px 0',
    caretColor: '#60a5fa',
  },
  '.cm-line': {
    padding: '0 8px',
    lineHeight: '1.6',
  },
  '.cm-gutters': {
    backgroundColor: '#0a0f1d',
    borderRight: '1px solid #1e293b',
    color: '#64748b',
    fontSize: '11px',
    paddingLeft: '4px',
    userSelect: 'none',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#1e293b',
    color: '#60a5fa',
    fontWeight: '600',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit',
  },
  '.cm-string': { color: '#34d399' },   // emerald-400
  '.cm-number': { color: '#fbbf24' },   // amber-400
  '.cm-bool': { color: '#c084fc' },     // purple-400
  '.cm-null': { color: '#94a3b8' },     // slate-400
  '.cm-property': { color: '#38bdf8' }, // sky-400
})

export const JsonCodeEditor: React.FC<JsonCodeEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  height,
  minHeight = '120px',
  maxHeight,
  label,
  placeholder,
  showLineNumbers = true,
  showToolbar = true,
  extraActions,
  className = '',
  error: propError = null,
  hideStats = false,
}) => {
  const isDark = useThemeStore((state) => state.isDark)
  const [copied, setCopied] = useState<boolean>(false)
  const [localError, setLocalError] = useState<string | null>(null)

  // 统计行数与字符数
  const lineCount = useMemo(() => {
    if (!value) return 1
    return value.split('\n').length
  }, [value])

  const charCount = useMemo(() => {
    return (value || '').length
  }, [value])

  // 复制功能
  const handleCopy = useCallback(() => {
    if (!value) return
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [value])

  // 格式化美化功能
  const handlePrettify = useCallback(() => {
    if (!value) return
    try {
      const parsed = JSON.parse(value)
      const formatted = JSON.stringify(parsed, null, 2)
      setLocalError(null)
      onChange?.(formatted)
    } catch (e: any) {
      setLocalError(e.message || 'JSON 语法错误')
    }
  }, [value, onChange])

  // 编辑器文本改动
  const handleChange = useCallback(
    (newVal: string) => {
      onChange?.(newVal)
      try {
        if (newVal.trim()) {
          JSON.parse(newVal)
        }
        setLocalError(null)
      } catch (e: any) {
        setLocalError(e.message)
      }
    },
    [onChange]
  )

  const activeError = propError || localError

  const extensions = useMemo(() => {
    const list: any[] = [json(), isDark ? darkEditorTheme : lightEditorTheme]
    if (readOnly) {
      list.push(EditorView.editable.of(false))
    }
    return list
  }, [readOnly, isDark])

  return (
    <div
      className={`flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-2xs group focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all ${className}`}
    >
      {/* 顶部内置工具栏 */}
      {showToolbar && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 select-none">
          {/* 左侧元信息 */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/15 border border-orange-200/80 dark:border-orange-500/30 px-1.5 py-0.2 rounded shrink-0">
              JSON
            </span>

            {label && (
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                {label}
              </span>
            )}

            {!hideStats && (
              <span className="font-mono text-[10px] text-slate-400 hidden sm:inline">
                {lineCount} 行 · {charCount} 字符
              </span>
            )}

            {readOnly && (
              <span className="text-[10px] font-mono text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-1 py-0.2 rounded font-medium">
                只读
              </span>
            )}
          </div>

          {/* 右侧操作按钮群 */}
          <div className="flex items-center gap-1.5">
            {extraActions}

            {/* 美化 JSON 按钮 */}
            {!readOnly && (
              <button
                type="button"
                onClick={handlePrettify}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-300 dark:hover:text-blue-400 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                title="美化并规范化当前 JSON 格式 (2空格缩进)"
              >
                <Sparkles className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                <span>美化</span>
              </button>
            )}

            {/* 复制按钮 */}
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="复制全部代码到剪贴板"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    已复制
                  </span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 text-slate-400 group-hover:text-slate-600" />
                  <span>复制</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* CodeMirror 编辑器核心区域 */}
      <div className="flex-1 overflow-hidden relative">
        <CodeMirror
          value={value}
          theme={isDark ? 'dark' : 'light'}
          height={height}
          minHeight={minHeight}
          maxHeight={maxHeight}
          placeholder={placeholder}
          extensions={extensions}
          onChange={handleChange}
          readOnly={readOnly}
          editable={!readOnly}
          basicSetup={{
            lineNumbers: showLineNumbers,
            foldGutter: true,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: !readOnly,
            autocompletion: !readOnly,
            highlightActiveLine: !readOnly,
            highlightActiveLineGutter: !readOnly,
          }}
        />
      </div>

      {/* 底部语法异常提醒条 */}
      {activeError && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/70 border-t border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-[11px] font-mono shrink-0">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">JSON 语法异常: {activeError}</span>
        </div>
      )}
    </div>
  )
}
