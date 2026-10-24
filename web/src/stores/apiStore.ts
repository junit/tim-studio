import { create } from 'zustand'

export interface ApiField {
  name: string
  label: string
  type: string
  required: boolean
  default: any
  placeholder: string
  help_text: string
  aliases: string[]
}

export interface ApiMeta {
  api_id: string
  name: string
  category: string
  subcategory: string
  path?: string[]
  doc_id?: number
  service_name: string
  command: string
  raw_command?: string
  doc_url: string
  description: string
  fields: ApiField[]
  sample_payload: Record<string, any>
}

export interface InvokeHistoryItem {
  id: string
  timeStr: string
  timestamp: number
  isOk: boolean
  actionStatus: string
  errorCode: number
  costMs: number
  dryRun: boolean
  payload: Record<string, any>
  response: any
}

export interface ApiTab {
  id: string
  apiId: string
  api: ApiMeta
  formData: Record<string, any>
  jsonText: string
  jsonError: string | null
  isModified: boolean
  requestTab: 'params' | 'body' | 'headers' | 'docs'
  bodyMode: 'form' | 'json'
  responseTab: 'pretty' | 'sent' | 'curl' | 'raw'
  invokeResponse: any
  invokeHistory?: InvokeHistoryItem[]
  isInvoking: boolean
  dataVersion?: number
}

export interface ToastMessage {
  id: string
  type?: 'success' | 'info' | 'warning'
  message: string
  actionLabel?: string
  onAction?: () => void
}

interface ApiState {
  apis: ApiMeta[]
  activeApi: ApiMeta | null
  tabs: ApiTab[]
  activeTabId: string | null
  toast: ToastMessage | null
  searchQuery: string
  openCategories: Record<string, boolean>
  isInvoking: boolean
  invokeResponse: any
  isSidebarOpen: boolean
  sidebarWidth: number
  isPreviewMode: boolean

  fetchApis: () => Promise<void>
  setActiveApi: (api: ApiMeta) => void
  openTab: (api: ApiMeta, overrides?: Partial<ApiTab>) => void
  closeTab: (tabId: string) => void
  closeOtherTabs: (tabId: string) => void
  closeTabsToRight: (tabId: string) => void
  closeAllTabs: () => void
  setActiveTabId: (tabId: string) => void
  updateActiveTab: (updates: Partial<ApiTab>) => void
  updateTab: (tabId: string, updates: Partial<ApiTab>) => void
  showToast: (toast: Omit<ToastMessage, 'id'>, duration?: number) => void
  dismissToast: () => void

  setSearchQuery: (query: string) => void
  toggleCategory: (key: string) => void
  expandAll: () => void
  collapseAll: () => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarWidth: (width: number) => void
  setPreviewMode: (enabled: boolean) => void
  togglePreviewMode: () => void
  invokeSingleApi: (apiId: string, payload: Record<string, any>, dryRun?: boolean) => Promise<any>
  clearTabInvokeHistory: (tabId: string) => void
  restoreTabInvokeHistory: (tabId: string, historyItem: InvokeHistoryItem, restorePayload?: boolean) => void
}

// 模糊子序列判定 (如: amw 匹配 admin_msgwithdraw)
function isSubsequence(sub: string, str: string): boolean {
  let s = 0, t = 0
  while (s < sub.length && t < str.length) {
    if (sub[s] === str[t]) s++
    t++
  }
  return s === sub.length
}

/**
 * 智能单输入框多维自适应匹配:
 * 1. 严格全字匹配 (精确命令、ID、中文名)
 * 2. 引号精确搜索 ("admin_msgwithdraw")
 * 3. 连续子串高优先级命中
 * 4. 多词分词并集/交集命中
 * 5. 首字母/子序列缩写匹配 (如 amw, c2c)
 */
export function smartMatchApi(api: ApiMeta, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const name = (api.name || '').toLowerCase()
  const cmd = (api.command || '').toLowerCase()
  const id = (api.api_id || '').toLowerCase()
  const desc = (api.description || '').toLowerCase()
  const subcat = (api.subcategory || '').toLowerCase()
  const cat = (api.category || '').toLowerCase()
  const docId = String(api.doc_id || '')

  // 1. 引号精确子串匹配: 例如 "msgwithdraw"
  if (q.startsWith('"') && q.endsWith('"') && q.length > 2) {
    const raw = q.slice(1, -1)
    return name.includes(raw) || cmd.includes(raw) || id.includes(raw) || docId === raw
  }

  // 2. 精确全词或文档 ID 命中
  if (cmd === q || id === q || name === q || subcat === q || cat === q || cmd.endsWith('/' + q) || docId === q) {
    return true
  }

  // 3. 连续子串匹配
  if (cmd.includes(q) || name.includes(q) || id.includes(q) || subcat.includes(q) || cat.includes(q) || desc.includes(q) || docId.includes(q)) {
    return true
  }

  // 4. 多词分词匹配 (空格分隔各词均在语料库中出现)
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length > 1) {
    const corpus = `${name} ${cmd} ${id} ${desc} ${subcat} ${cat} ${docId}`
    if (tokens.every(token => corpus.includes(token))) {
      return true
    }
  }

  // 5. 缩写/模糊子序列匹配 (如 amw 匹配 admin_msgwithdraw, c2c 匹配 c2c_msg_withdraw)
  if (isSubsequence(q, cmd) || isSubsequence(q, name) || isSubsequence(q, id)) {
    return true
  }

  return false
}

export function initializeFormData(api: ApiMeta): Record<string, any> {
  const result: Record<string, any> = { ...(api.sample_payload || {}) }

  // 针对有定义 fields 的接口，根据 fields 进行字段智能补全与映射
  if (api.fields && api.fields.length > 0) {
    for (const f of api.fields) {
      if (result[f.name] !== undefined) {
        continue
      }
      // 常见字段提取
      if (
        (f.name === 'Text' || f.name === 'content') &&
        api.sample_payload?.MsgBody?.[0]?.MsgContent?.Text
      ) {
        result[f.name] = api.sample_payload.MsgBody[0].MsgContent.Text
      } else if (
        f.name === 'NewText' &&
        api.sample_payload?.MsgBody?.[0]?.MsgContent?.Text
      ) {
        result[f.name] = api.sample_payload.MsgBody[0].MsgContent.Text
      } else if (f.name === 'Text' && api.sample_payload?.Content) {
        result[f.name] = api.sample_payload.Content
      } else if (f.name === 'Tags' && api.sample_payload?.UserTags?.[0]?.Tags) {
        result[f.name] = api.sample_payload.UserTags[0].Tags
      } else if (
        f.name === 'Member_Accounts' &&
        Array.isArray(api.sample_payload?.MemberList)
      ) {
        result[f.name] = api.sample_payload.MemberList.map((m: any) => m.Member_Account)
      } else if (
        f.name === 'Nick' &&
        Array.isArray(api.sample_payload?.ProfileItem)
      ) {
        const item = api.sample_payload.ProfileItem.find(
          (p: any) => p.Tag === 'Tag_Profile_IM_Nick'
        )
        if (item) result[f.name] = item.Value
      } else if (
        f.name === 'FaceUrl' &&
        Array.isArray(api.sample_payload?.ProfileItem)
      ) {
        const item = api.sample_payload.ProfileItem.find(
          (p: any) => p.Tag === 'Tag_Profile_IM_Image'
        )
        if (item) result[f.name] = item.Value
      } else if (
        f.name === 'SelfSignature' &&
        Array.isArray(api.sample_payload?.ProfileItem)
      ) {
        const item = api.sample_payload.ProfileItem.find(
          (p: any) => p.Tag === 'Tag_Profile_IM_SelfSignature'
        )
        if (item) result[f.name] = item.Value
      } else if (
        f.name === 'MsgSeq' &&
        Array.isArray(api.sample_payload?.MsgSeqList)
      ) {
        result[f.name] = api.sample_payload.MsgSeqList[0]?.MsgSeq
      } else if (
        f.name === 'Key' &&
        Array.isArray(api.sample_payload?.ExtensionList)
      ) {
        result[f.name] = api.sample_payload.ExtensionList[0]?.Key
      } else if (
        f.name === 'Value' &&
        Array.isArray(api.sample_payload?.ExtensionList)
      ) {
        result[f.name] = api.sample_payload.ExtensionList[0]?.Value
      } else if (f.default !== undefined && f.default !== null) {
        result[f.name] = f.default
      }
    }
  }
  return result
}

function getLocalApiHistory(apiId: string): InvokeHistoryItem[] {
  try {
    const raw = localStorage.getItem(`tim_api_hist_${apiId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalApiHistory(apiId: string, history: InvokeHistoryItem[]) {
  try {
    localStorage.setItem(`tim_api_hist_${apiId}`, JSON.stringify(history.slice(0, 15)))
  } catch (e) {
    console.error('Failed to save api history to localStorage', e)
  }
}

function clearLocalApiHistory(apiId: string) {
  try {
    localStorage.removeItem(`tim_api_hist_${apiId}`)
  } catch {}
}

function createTabFromApi(api: ApiMeta): ApiTab {
  const initialData = initializeFormData(api)
  const savedHistory = getLocalApiHistory(api.api_id)
  const lastHistory = savedHistory[0] || null

  return {
    id: api.api_id,
    apiId: api.api_id,
    api,
    formData: initialData,
    jsonText: JSON.stringify(initialData, null, 2),
    jsonError: null,
    isModified: false,
    requestTab: 'body',
    bodyMode: 'form',
    responseTab: 'pretty',
    invokeResponse: lastHistory ? lastHistory.response : null,
    invokeHistory: savedHistory,
    isInvoking: false,
    dataVersion: Date.now(),
  }
}

export const useApiStore = create<ApiState>((set, get) => ({
  apis: [],
  activeApi: null,
  tabs: [],
  activeTabId: null,
  toast: null,
  searchQuery: '',
  openCategories: {}, // 默认收起全部
  isInvoking: false,
  invokeResponse: null,
  isSidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 1024 : true, // 大屏默认展开，小屏/移动端默认收起
  sidebarWidth: 320, // 侧边栏固定默认宽度 320px
  isPreviewMode: false,

  fetchApis: async () => {
    try {
      const res = await fetch('/api/apis')
      const json = await res.json()
      if (json.status === 'success') {
        const apis: ApiMeta[] = json.data
        const defaultApi = apis.find(a => a.api_id === 'c2c_msg_withdraw') || apis[0] || null
        let initialTabs: ApiTab[] = []
        if (defaultApi) {
          initialTabs = [createTabFromApi(defaultApi)]
        }
        set({
          apis,
          tabs: initialTabs,
          activeTabId: defaultApi ? defaultApi.api_id : null,
          activeApi: defaultApi,
          invokeResponse: initialTabs[0]?.invokeResponse || null,
          openCategories: {},
        })
      }
    } catch (e) {
      console.error('Failed to fetch APIs', e)
    }
  },

  setActiveApi: (api: ApiMeta) => {
    get().openTab(api)
  },

  openTab: (api: ApiMeta, overrides?: Partial<ApiTab>) => {
    const { tabs } = get()
    const existing = tabs.find(t => t.apiId === api.api_id)
    if (existing) {
      const updated = overrides
        ? { ...existing, ...overrides, dataVersion: Date.now() }
        : existing
      set({
        tabs: overrides ? tabs.map(t => t.id === existing.id ? updated : t) : tabs,
        activeTabId: existing.id,
        activeApi: existing.api,
        invokeResponse: updated.invokeResponse,
        isInvoking: updated.isInvoking,
      })
    } else {
      const newTab = { ...createTabFromApi(api), ...(overrides || {}), dataVersion: Date.now() }
      set({
        tabs: [...tabs, newTab],
        activeTabId: newTab.id,
        activeApi: api,
        invokeResponse: newTab.invokeResponse,
        isInvoking: false,
      })
    }
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId } = get()
    const tabIndex = tabs.findIndex(t => t.id === tabId)
    if (tabIndex === -1) return

    const newTabs = tabs.filter(t => t.id !== tabId)
    let nextActiveTabId = activeTabId
    let nextActiveApi = get().activeApi

    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        const nextIndex = Math.max(0, tabIndex - 1)
        const nextTab = newTabs[nextIndex]
        nextActiveTabId = nextTab.id
        nextActiveApi = nextTab.api
      } else {
        nextActiveTabId = null
        nextActiveApi = null
      }
    }

    const currentTab = newTabs.find(t => t.id === nextActiveTabId)
    set({
      tabs: newTabs,
      activeTabId: nextActiveTabId,
      activeApi: nextActiveApi,
      invokeResponse: currentTab?.invokeResponse || null,
      isInvoking: currentTab?.isInvoking || false,
    })
  },

  closeOtherTabs: (tabId: string) => {
    const { tabs } = get()
    const keepTab = tabs.find(t => t.id === tabId)
    if (!keepTab) return
    set({
      tabs: [keepTab],
      activeTabId: keepTab.id,
      activeApi: keepTab.api,
      invokeResponse: keepTab.invokeResponse,
      isInvoking: keepTab.isInvoking,
    })
  },

  closeTabsToRight: (tabId: string) => {
    const { tabs, activeTabId } = get()
    const index = tabs.findIndex(t => t.id === tabId)
    if (index === -1) return
    const newTabs = tabs.slice(0, index + 1)
    let nextActiveTabId = activeTabId
    let nextActiveApi = get().activeApi
    if (!newTabs.some(t => t.id === activeTabId)) {
      nextActiveTabId = tabId
      const current = newTabs.find(t => t.id === tabId)
      nextActiveApi = current ? current.api : null
    }
    const currentTab = newTabs.find(t => t.id === nextActiveTabId)
    set({
      tabs: newTabs,
      activeTabId: nextActiveTabId,
      activeApi: nextActiveApi,
      invokeResponse: currentTab?.invokeResponse || null,
      isInvoking: currentTab?.isInvoking || false,
    })
  },

  closeAllTabs: () => {
    set({
      tabs: [],
      activeTabId: null,
      activeApi: null,
      invokeResponse: null,
      isInvoking: false,
    })
  },

  setActiveTabId: (tabId: string) => {
    const { tabs } = get()
    const target = tabs.find(t => t.id === tabId)
    if (target) {
      set({
        activeTabId: target.id,
        activeApi: target.api,
        invokeResponse: target.invokeResponse,
        isInvoking: target.isInvoking,
      })
    }
  },

  updateActiveTab: (updates: Partial<ApiTab>) => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return
    const newTabs = tabs.map(t => {
      if (t.id === activeTabId) {
        return { ...t, ...updates }
      }
      return t
    })
    set({ tabs: newTabs })
  },

  updateTab: (tabId: string, updates: Partial<ApiTab>) => {
    const { tabs } = get()
    const newTabs = tabs.map(t => {
      if (t.id === tabId) {
        return { ...t, ...updates }
      }
      return t
    })
    set({ tabs: newTabs })
  },

  showToast: (toast: Omit<ToastMessage, 'id'>, duration: number = 3500) => {
    const id = Math.random().toString(36).slice(2, 9)
    set({ toast: { ...toast, id } })
    if (duration > 0) {
      setTimeout(() => {
        if (get().toast?.id === id) {
          set({ toast: null })
        }
      }, duration)
    }
  },

  dismissToast: () => set({ toast: null }),

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  toggleCategory: (key: string) => {
    set((state) => ({
      openCategories: {
        ...state.openCategories,
        [key]: !state.openCategories[key],
      },
    }))
  },

  expandAll: () => {
    const { apis } = get()
    const all: Record<string, boolean> = {}
    apis.forEach((a) => {
      const parts = (a.path && a.path.length > 0)
        ? a.path
        : [a.category, a.subcategory].filter(Boolean) as string[]
      let cur = ''
      parts.forEach((p) => {
        cur = cur ? `${cur}:::${p}` : p
        all[cur] = true
      })
    })
    set({ openCategories: all })
  },

  collapseAll: () => {
    set({ openCategories: {} })
  },

  toggleSidebar: () => {
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen }))
  },

  setSidebarOpen: (open: boolean) => {
    set({ isSidebarOpen: open })
  },

  setSidebarWidth: (width: number) => {
    set({ sidebarWidth: Math.max(260, Math.min(560, width)) })
  },

  setPreviewMode: (enabled: boolean) => set({ isPreviewMode: enabled }),

  togglePreviewMode: () => set((state) => ({ isPreviewMode: !state.isPreviewMode })),

  invokeSingleApi: async (apiId: string, payload: Record<string, any>, dryRun?: boolean) => {
    const isDry = dryRun !== undefined ? dryRun : get().isPreviewMode
    const { activeTabId } = get()
    if (activeTabId) {
      get().updateTab(activeTabId, { isInvoking: true })
    }
    set({ isInvoking: true, invokeResponse: null })
    try {
      const res = await fetch(`/api/apis/${apiId}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, dry_run: isDry }),
      })
      const data = await res.json()
      const now = new Date()
      const timeStr =
        now.toTimeString().split(' ')[0] +
        '.' +
        String(now.getMilliseconds()).padStart(3, '0')
      const isOk =
        Boolean(data.dry_run) ||
        (data.response?.ActionStatus === 'OK' &&
          (data.response?.ErrorCode === 0 || data.response?.ErrorCode === undefined))
      const historyItem: InvokeHistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        timeStr,
        timestamp: Date.now(),
        isOk,
        actionStatus: data.dry_run
          ? 'PREVIEW'
          : data.response?.ActionStatus || (isOk ? 'OK' : 'FAIL'),
        errorCode: data.response?.ErrorCode ?? (isOk ? 0 : -1),
        costMs: data.cost_ms ?? 0,
        dryRun: Boolean(data.dry_run),
        payload: payload || {},
        response: data,
      }

      if (activeTabId) {
        const currentTab = get().tabs.find((t) => t.id === activeTabId)
        const prevHistory = currentTab?.invokeHistory || []
        const newHistory = [historyItem, ...prevHistory.filter(h => h.id !== historyItem.id).slice(0, 14)]
        if (currentTab) {
          saveLocalApiHistory(currentTab.apiId, newHistory)
        }
        get().updateTab(activeTabId, {
          invokeResponse: data,
          invokeHistory: newHistory,
          isInvoking: false,
        })
      }
      set({ invokeResponse: data, isInvoking: false })
      return data
    } catch (e: any) {
      const errRes = { status: 'error', message: e.message || String(e) }
      const now = new Date()
      const timeStr =
        now.toTimeString().split(' ')[0] +
        '.' +
        String(now.getMilliseconds()).padStart(3, '0')
      const historyItem: InvokeHistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        timeStr,
        timestamp: Date.now(),
        isOk: false,
        actionStatus: 'ERROR',
        errorCode: -1,
        costMs: 0,
        dryRun: Boolean(isDry),
        payload: payload || {},
        response: errRes,
      }
      if (activeTabId) {
        const currentTab = get().tabs.find((t) => t.id === activeTabId)
        const prevHistory = currentTab?.invokeHistory || []
        const newHistory = [historyItem, ...prevHistory.filter(h => h.id !== historyItem.id).slice(0, 14)]
        if (currentTab) {
          saveLocalApiHistory(currentTab.apiId, newHistory)
        }
        get().updateTab(activeTabId, {
          invokeResponse: errRes,
          invokeHistory: newHistory,
          isInvoking: false,
        })
      }
      set({ invokeResponse: errRes, isInvoking: false })
      return errRes
    }
  },

  clearTabInvokeHistory: (tabId: string) => {
    const currentTab = get().tabs.find((t) => t.id === tabId)
    if (currentTab) {
      clearLocalApiHistory(currentTab.apiId)
    }
    get().updateTab(tabId, { invokeHistory: [] })
  },

  restoreTabInvokeHistory: (tabId: string, historyItem: InvokeHistoryItem, restorePayload = false) => {
    const currentTab = get().tabs.find((t) => t.id === tabId)
    const updates: Partial<ApiTab> = {
      invokeResponse: historyItem.response,
    }
    if (restorePayload && historyItem.payload) {
      updates.formData = historyItem.payload
      updates.jsonText = JSON.stringify(historyItem.payload, null, 2)
      updates.dataVersion = (currentTab?.dataVersion || 0) + 1
    }
    get().updateTab(tabId, updates)
    set({ invokeResponse: historyItem.response })
  },
}))
