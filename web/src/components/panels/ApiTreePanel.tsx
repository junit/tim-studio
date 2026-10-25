import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  X,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ChevronsDownUp,
  Folder,
  FolderOpen,
  Code2,
  Tag,
  Layers,
  Check,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useApiStore, smartMatchApi, ApiMeta } from '@/stores/apiStore'
import { useBatchStore } from '@/stores/batchStore'

export interface TreeNode {
  name: string
  path: string[]
  pathKey: string
  level: number
  subNodes: TreeNode[]
  apis: ApiMeta[]
  totalCount: number
}

interface ApiItemProps {
  api: ApiMeta
  isActive: boolean
  isBatchTarget: boolean
  onSelect: (api: ApiMeta) => void
  onSetBatchTarget: (e: React.MouseEvent, api: ApiMeta) => void
}

const ApiItem: React.FC<ApiItemProps> = ({
  api,
  isActive,
  isBatchTarget,
  onSelect,
  onSetBatchTarget,
}) => {
  return (
    <div
      onClick={() => onSelect(api)}
      className={`group relative flex items-center justify-between rounded-lg px-2.5 py-1.5 cursor-pointer transition-all border-l-[3px] ${
        isActive
          ? 'bg-blue-50/80 dark:bg-blue-950/40 text-slate-900 dark:text-blue-100 border-l-blue-500 border-y border-r border-blue-200/60 dark:border-blue-900/40 shadow-2xs font-semibold'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 border-l-transparent border-y border-r border-transparent'
      }`}
    >
      <div className="min-w-0 flex-1 pr-1.5">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className={`font-mono text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
              isActive
                ? 'bg-orange-500 text-white shadow-2xs'
                : 'bg-orange-500/10 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-200/80 dark:border-orange-500/30 group-hover:bg-orange-500/20'
            }`}
          >
            POST
          </span>
          <span className="text-xs truncate leading-snug">{api.name}</span>
        </div>
        <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500 truncate pl-0.5">
          {api.command}
        </p>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => onSetBatchTarget(e, api)}
          title={
            isBatchTarget
              ? '已设为批量调用目标 (点击可跳转或重新配置)'
              : '快速设为批量调用目标'
          }
          className={`rounded p-1 text-[10px] transition-colors cursor-pointer ${
            isBatchTarget
              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
              : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {isBatchTarget ? (
            <Check className="h-3 w-3" />
          ) : (
            <Layers className="h-3 w-3" />
          )}
        </button>
      </div>
    </div>
  )
}

interface SubFolderNodeProps {
  node: TreeNode
  openCategories: Record<string, boolean>
  searchQuery: string
  activeApi: ApiMeta | null
  batchApiId: string | null
  toggleCategory: (key: string) => void
  onSelectApi: (api: ApiMeta) => void
  onSetBatchTarget: (e: React.MouseEvent, api: ApiMeta) => void
}

const SubFolderView: React.FC<SubFolderNodeProps> = ({
  node,
  openCategories,
  searchQuery,
  activeApi,
  batchApiId,
  toggleCategory,
  onSelectApi,
  onSetBatchTarget,
}) => {
  const isOpen = searchQuery ? true : !!openCategories[node.pathKey]
  const isLevel3Plus = node.level >= 3

  return (
    <div
      className={`rounded-lg bg-white dark:bg-slate-900/70 border border-slate-100/90 dark:border-slate-800/80 overflow-hidden ${
        isLevel3Plus ? 'ml-2 pl-1 border-l-2 border-l-blue-200/80 dark:border-l-blue-500/50' : ''
      }`}
    >
      {/* 子菜单分类标题栏 */}
      <button
        onClick={() => toggleCategory(node.pathKey)}
        className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left transition-colors group cursor-pointer ${
          isLevel3Plus
            ? 'bg-slate-50/90 dark:bg-slate-800/40 hover:bg-blue-50/40 dark:hover:bg-blue-950/40'
            : 'bg-slate-100/60 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-slate-400 dark:text-slate-500 group-hover:text-blue-500 dark:group-hover:text-blue-400">
            {isOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
          <Tag
            className={`h-3 w-3 shrink-0 ${
              isLevel3Plus
                ? 'text-blue-500 dark:text-blue-400'
                : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500 dark:group-hover:text-blue-400'
            }`}
          />
          <span
            className={`truncate ${
              isLevel3Plus
                ? 'text-[11px] font-medium text-slate-800 dark:text-slate-200'
                : 'text-[11px] font-semibold text-slate-700 dark:text-slate-300'
            }`}
          >
            {node.name}
          </span>
        </div>

        <span className="font-mono text-[9px] text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-850 px-1.5 py-0.2 rounded border border-slate-200/80 dark:border-slate-750 shrink-0">
          {node.totalCount}
        </span>
      </button>

      {/* 子菜单内容展开 */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="overflow-hidden p-1 space-y-1"
          >
            {/* 本级直接拥有的 API 列表 */}
            {node.apis.length > 0 && (
              <div className="space-y-0.5">
                {node.apis.map((api) => (
                  <ApiItem
                    key={api.api_id}
                    api={api}
                    isActive={activeApi?.api_id === api.api_id}
                    isBatchTarget={batchApiId === api.api_id}
                    onSelect={onSelectApi}
                    onSetBatchTarget={onSetBatchTarget}
                  />
                ))}
              </div>
            )}

            {/* 下级子目录 (如 Level 3 权限组管理 等) */}
            {node.subNodes.length > 0 && (
              <div className="space-y-1 pt-0.5">
                {node.subNodes.map((childNode) => (
                  <SubFolderView
                    key={childNode.pathKey}
                    node={childNode}
                    openCategories={openCategories}
                    searchQuery={searchQuery}
                    activeApi={activeApi}
                    batchApiId={batchApiId}
                    toggleCategory={toggleCategory}
                    onSelectApi={onSelectApi}
                    onSetBatchTarget={onSetBatchTarget}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface ApiTreePanelProps {
  onNavigateToBatch?: () => void
  onCloseSidebar?: () => void
  isMobile?: boolean
}

export const ApiTreePanel: React.FC<ApiTreePanelProps> = ({ onNavigateToBatch, onCloseSidebar, isMobile }) => {
  const {
    apis,
    activeApi,
    searchQuery,
    openCategories,
    openTab,
    showToast,
    setSearchQuery,
    toggleCategory,
    expandAll,
    collapseAll,
  } = useApiStore()

  const { setApiId, apiId: batchApiId } = useBatchStore()

  // 自动智能多维匹配（全词精确、连续子串、分词交集、拼音/首字母缩写一站式支持）
  const filteredApis = useMemo(() => {
    return apis.filter((api) => {
      if (!searchQuery.trim()) return true
      return smartMatchApi(api, searchQuery)
    })
  }, [apis, searchQuery])

  // 递归组织任意多级树型结构 (基于 api.path)
  const treeRoots = useMemo<TreeNode[]>(() => {
    interface InternalNode {
      name: string
      path: string[]
      pathKey: string
      level: number
      children: Map<string, InternalNode>
      apis: ApiMeta[]
    }

    const rootMap = new Map<string, InternalNode>()

    filteredApis.forEach((api) => {
      const segments = (api.path && api.path.length > 0)
        ? api.path
        : [api.category || '其它分类', api.subcategory].filter(Boolean) as string[]

      if (segments.length === 0) {
        segments.push('其它分类')
      }

      let currentMap = rootMap
      let currentPath: string[] = []

      segments.forEach((seg, idx) => {
        currentPath = [...currentPath, seg]
        const pathKey = currentPath.join(':::')
        const level = idx + 1

        if (!currentMap.has(seg)) {
          currentMap.set(seg, {
            name: seg,
            path: currentPath,
            pathKey,
            level,
            children: new Map(),
            apis: [],
          })
        }

        const node = currentMap.get(seg)!
        if (idx === segments.length - 1) {
          node.apis.push(api)
        }
        currentMap = node.children
      })
    })

    function convert(node: InternalNode): TreeNode {
      const subNodes = Array.from(node.children.values()).map(convert)
      const directCount = node.apis.length
      const childCount = subNodes.reduce((sum, n) => sum + n.totalCount, 0)
      return {
        name: node.name,
        path: node.path,
        pathKey: node.pathKey,
        level: node.level,
        subNodes,
        apis: node.apis,
        totalCount: directCount + childCount,
      }
    }

    return Array.from(rootMap.values()).map(convert)
  }, [filteredApis])

  // 判断当前是否已处于全展开状态
  const isAllExpanded = useMemo(() => {
    if (apis.length === 0) return false
    return apis.every((a) => {
      const parts = (a.path && a.path.length > 0)
        ? a.path
        : [a.category, a.subcategory].filter(Boolean) as string[]
      let cur = ''
      for (const p of parts) {
        cur = cur ? `${cur}:::${p}` : p
        if (!openCategories[cur]) return false
      }
      return true
    })
  }, [apis, openCategories])

  const handleToggleAll = () => {
    if (isAllExpanded) {
      collapseAll()
    } else {
      expandAll()
    }
  }

  const handleSelectApi = (api: ApiMeta) => {
    openTab(api)
    // 仅在移动端小屏浮层模式下，点击选择接口后自动收回浮层；桌面端保持侧边栏常驻，不自动缩回
    const isSmallScreen = isMobile ?? (typeof window !== 'undefined' ? window.innerWidth < 1024 : false)
    if (isSmallScreen) {
      onCloseSidebar?.()
    }
  }

  const handleSetBatchTarget = (e: React.MouseEvent, api: ApiMeta) => {
    e.stopPropagation()
    setApiId(api.api_id)
    showToast({
      type: 'success',
      message: `已将「${api.name}」设为批处理目标接口`,
      actionLabel: '前往批处理中心 →',
      onAction: onNavigateToBatch,
    })
  }

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 select-none overflow-hidden">
      {/* 顶部搜索与操作栏：单行紧凑布局 */}
      <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
        <div className="flex items-center gap-1.5">
          {/* 单一全能自适应输入框 */}
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索接口、Command或缩写..."
              className="pl-8 pr-7 h-8 text-xs bg-white dark:bg-slate-900 shadow-2xs border-slate-200 dark:border-slate-750 text-slate-900 dark:text-slate-100 focus-visible:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 展开全部/全部收起 按钮 */}
          <button
            onClick={handleToggleAll}
            title={isAllExpanded ? '一键全部折叠' : '一键全部展开'}
            className="flex items-center gap-1 h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-850 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500/50 hover:bg-blue-50/40 dark:hover:bg-blue-950/40 shadow-2xs transition-all shrink-0 cursor-pointer active:scale-95"
          >
            {isAllExpanded ? (
              <>
                <ChevronsDownUp className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                <span className="text-[11px]">收起</span>
              </>
            ) : (
              <>
                <ChevronsUpDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-[11px]">展开</span>
              </>
            )}
          </button>

          {/* 移动端专属关闭侧边栏按钮 */}
          {onCloseSidebar && (
            <button
              type="button"
              onClick={onCloseSidebar}
              title="关闭导航栏"
              className="lg:hidden flex items-center justify-center h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-850 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 shrink-0 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 仅在有搜索内容时展示结果数提示 */}
        {searchQuery && (
          <div className="pt-1.5 px-1 text-[11px] font-mono text-slate-400 dark:text-slate-500">
            匹配到 {filteredApis.length} 个结果
          </div>
        )}
      </div>

      {/* 多级树型结构主体 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {treeRoots.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500">
            <Code2 className="h-8 w-8 mb-2 stroke-1 text-slate-300 dark:text-slate-700" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">未找到匹配的 REST API</p>
            <p className="text-[11px] mt-1 text-slate-400 dark:text-slate-500">
              已自动进行全词、子串及拼音缩写检索，无符合项
            </p>
          </div>
        ) : (
          treeRoots.map((catNode) => {
            const isCatOpen = searchQuery ? true : !!openCategories[catNode.pathKey]

            return (
              <div
                key={catNode.pathKey}
                className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs"
              >
                {/* Level 1: 一级大类头部 */}
                <button
                  onClick={() => toggleCategory(catNode.pathKey)}
                  className="w-full flex items-center justify-between px-2.5 py-2 text-left bg-slate-50/70 dark:bg-slate-850 hover:bg-slate-100/90 dark:hover:bg-slate-800 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-transform">
                      {isCatOpen ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="text-amber-500">
                      {isCatOpen ? (
                        <FolderOpen className="h-3.5 w-3.5 fill-amber-500/15" />
                      ) : (
                        <Folder className="h-3.5 w-3.5 fill-slate-400/10 dark:fill-slate-600/10 text-slate-400 dark:text-slate-500" />
                      )}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-white">
                      {catNode.name}
                    </span>
                  </div>

                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] px-1.5 py-0 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 shrink-0"
                  >
                    {catNode.totalCount}
                  </Badge>
                </button>

                {/* Level 1 展开容器 */}
                <AnimatePresence initial={false}>
                  {isCatOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeInOut' }}
                      className="overflow-hidden bg-slate-50/30 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800"
                    >
                      <div className="p-1 space-y-1">
                        {/* 如果该分类直接拥有 API（如 1 级分类 全员/标签推送、运营管理 等），直接渲染 API 列表，无重复假子目录 */}
                        {catNode.apis.length > 0 && (
                          <div className="space-y-0.5">
                            {catNode.apis.map((api) => (
                              <ApiItem
                                key={api.api_id}
                                api={api}
                                isActive={activeApi?.api_id === api.api_id}
                                isBatchTarget={batchApiId === api.api_id}
                                onSelect={handleSelectApi}
                                onSetBatchTarget={handleSetBatchTarget}
                              />
                            ))}
                          </div>
                        )}

                        {/* 如果拥有子目录（如 2 级、3 级分类），渲染子目录组件 */}
                        {catNode.subNodes.map((subNode) => (
                          <SubFolderView
                            key={subNode.pathKey}
                            node={subNode}
                            openCategories={openCategories}
                            searchQuery={searchQuery}
                            activeApi={activeApi}
                            batchApiId={batchApiId}
                            toggleCategory={toggleCategory}
                            onSelectApi={handleSelectApi}
                            onSetBatchTarget={handleSetBatchTarget}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
