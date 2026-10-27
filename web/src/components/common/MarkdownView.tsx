import React, { useMemo, useState, useRef } from 'react'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'
import { Copy, Check } from 'lucide-react'
import { EChartsViewer } from '@/components/agent/EChartsViewer'

interface MarkdownViewProps {
  content: string
  className?: string
  /** 是否开启整体复制，默认为 false（避免在聊天气泡或普通段落中遮挡首行文字） */
  copyable?: boolean
  /** 整体复制按钮展示模式：'header' (顶部独立工具条，不遮挡文字) | 'floating' (右上角悬浮并带安全边距) | 'none' */
  copyMode?: 'header' | 'floating' | 'none'
  /** 工具条左侧标题（仅在 copyMode === 'header' 时生效） */
  title?: string
  /** 外层容器类名 */
  containerClassName?: string
}

// 配置 marked 解析选项：支持换行、GFM 表格与 highlight.js 代码语法高亮与代码块独立复制
marked.setOptions({
  breaks: true,
  gfm: true,
})

marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const cleanLang = (lang || '').trim().toLowerCase()
      const validLang = Boolean(cleanLang && hljs.getLanguage(cleanLang))
      let highlighted = text
      try {
        highlighted = validLang
          ? hljs.highlight(text, { language: cleanLang }).value
          : hljs.highlightAuto(text).value
      } catch (err) {
        highlighted = text
      }
      const encoded = encodeURIComponent(text)
      return `
        <div class="code-block-wrapper relative group/code my-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0b0f19] overflow-hidden shadow-2xs">
          <div class="flex items-center justify-between px-3 py-1.5 bg-slate-100/90 dark:bg-slate-900/90 text-[11px] text-slate-500 dark:text-slate-400 font-mono border-b border-slate-200 dark:border-slate-800/80 select-none">
            <span class="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">${cleanLang || 'code'}</span>
            <button type="button" class="markdown-code-copy-btn flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer text-[10px]" data-code="${encoded}">
              <svg class="h-3 w-3 copy-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              <span class="copy-label">复制代码</span>
            </button>
          </div>
          <pre class="hljs-pre !my-0 !rounded-none !border-0 bg-slate-50 text-slate-800 dark:bg-[#0b0f19] dark:text-[#e2e8f0]"><code class="hljs ${validLang ? 'language-' + cleanLang : ''}">${highlighted}</code></pre>
        </div>
      `
    },
  },
})

export const MarkdownView: React.FC<MarkdownViewProps> = ({
  content,
  className = '',
  copyable = false,
  copyMode = 'header',
  title = '',
  containerClassName = '',
}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 预处理内容：清洗模型内部协议残留，并将多行 <code>...</code> 规范化为 Markdown 代码块
  const preprocessedContent = useMemo(() => {
    if (!content) return ''
    let cleaned = content

    // 1. 过滤任何泄漏到正文中的 Calling tools: [...] 内部调试调用
    cleaned = cleaned.replace(/Calling tools:\s*\[[\s\S]*?\]/g, '').trim()

    // 2. 过滤任何残留的 DeepSeek 原生 DSML 工具标记
    cleaned = cleaned.replace(/<｜｜DSML｜｜\s*calls>[\s\S]*?(?:<\/invoke>|$)/g, '').trim()
    cleaned = cleaned.replace(/<parameter name=["']code["']>([\s\S]*?)<\/parameter>/gi, '\n```python\n$1\n```\n')

    // 3. 将大模型可能输出的 <code>...</code> 标签规范化为 Markdown 代码块 ```python
    cleaned = cleaned.replace(/<code>\s*([\s\S]*?)\s*<\/code>/gi, (_match, p1) => {
      const code = p1.trim()
      if (code.includes('\n') || code.includes('import ') || code.includes('def ') || code.includes(' = ')) {
        return `\n\`\`\`python\n${code}\n\`\`\`\n`
      }
      return `\`${code}\``
    })

    return cleaned
  }, [content])

  // 检查是否包含 ```echarts 或 ```chart 语法块，支持代码块就地交互式图表渲染
  const segments = useMemo(() => {
    if (!preprocessedContent) return []
    const regex = /```(?:echarts|chart)\s*\n([\s\S]*?)\n```/gi
    let match
    let lastIndex = 0
    const list: Array<{ type: 'markdown' | 'echarts'; text: string }> = []

    while ((match = regex.exec(preprocessedContent)) !== null) {
      const matchStart = match.index
      const matchEnd = regex.lastIndex
      if (matchStart > lastIndex) {
        list.push({
          type: 'markdown',
          text: preprocessedContent.slice(lastIndex, matchStart),
        })
      }
      list.push({
        type: 'echarts',
        text: match[1],
      })
      lastIndex = matchEnd
    }

    if (lastIndex < preprocessedContent.length) {
      list.push({
        type: 'markdown',
        text: preprocessedContent.slice(lastIndex),
      })
    }

    return list
  }, [preprocessedContent])

  const htmlContent = useMemo(() => {
    if (!preprocessedContent || segments.some((s) => s.type === 'echarts')) return ''
    try {
      return marked.parse(preprocessedContent) as string
    } catch (e) {
      console.error('Failed to parse markdown:', e)
      return preprocessedContent
    }
  }, [preprocessedContent, segments])

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!preprocessedContent) return
    navigator.clipboard.writeText(preprocessedContent)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  // 捕获内部各个代码块自带的复制按钮点击事件
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('.markdown-code-copy-btn') as HTMLElement | null
    if (!target) return
    e.stopPropagation()
    const rawCode = target.getAttribute('data-code')
    if (rawCode) {
      try {
        const code = decodeURIComponent(rawCode)
        navigator.clipboard.writeText(code)
        const label = target.querySelector('.copy-label')
        if (label) {
          label.textContent = '已复制'
          target.classList.add('text-emerald-400')
          setTimeout(() => {
            label.textContent = '复制代码'
            target.classList.remove('text-emerald-400')
          }, 2000)
        }
      } catch (err) {
        console.error('Failed to copy code snippet:', err)
      }
    }
  }

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className={`relative group/markdown ${containerClassName}`}
    >
      {/* 模式 1: 独立 Header 工具条（位于正文上方，彻底避免遮挡正文） */}
      {copyable && content && copyMode === 'header' && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200/90 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 select-none rounded-t-xl">
          <span>{title || '正文内容'}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            {isCopied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">已复制</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-slate-400" />
                <span className="text-[11px]">复制</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 模式 2: 浮动复制按钮（预留右侧 pr-14 安全边距，杜绝文字重叠） */}
      {copyable && content && copyMode === 'floating' && (
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2 right-2 z-10 px-2 py-1 rounded-lg bg-white/95 dark:bg-slate-900/95 hover:bg-white dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 border border-slate-200/90 dark:border-slate-800 shadow-xs backdrop-blur-xs flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-all opacity-80 hover:opacity-100"
          title="复制全部正文"
        >
          {isCopied ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">已复制</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 text-slate-400" />
              <span className="text-[11px]">复制</span>
            </>
          )}
        </button>
      )}

      {segments.some((s) => s.type === 'echarts') ? (
        <div className={`space-y-2 ${copyable && copyMode === 'floating' ? 'pr-16' : ''} ${className}`}>
          {segments.map((seg, idx) => {
            if (seg.type === 'echarts') {
              return <EChartsViewer key={idx} code={seg.text} />
            }
            let html = ''
            try {
              html = marked.parse(seg.text) as string
            } catch {
              html = seg.text
            }
            return (
              <div
                key={idx}
                className="markdown-content"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )
          })}
        </div>
      ) : (
        <div
          className={`markdown-content ${copyable && copyMode === 'floating' ? 'pr-16' : ''} ${className}`}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      )}
    </div>
  )
}
