import { create } from 'zustand'

export interface HistoryItem {
  task_id: string
  api_id: string
  api_name?: string
  total: number
  success: number
  failed: number
  duration_sec: number
  status: string
  created_at: string
  result_count?: number
  results?: any[]
}

interface HistoryState {
  historyList: HistoryItem[]
  selectedTask: HistoryItem | null
  isLoading: boolean
  isDetailLoading: boolean

  fetchHistory: () => Promise<void>
  fetchDetail: (taskId: string) => Promise<void>
  clearSelected: () => void
  deleteHistory: (taskId: string) => Promise<boolean>
  clearAllHistory: () => Promise<boolean>
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  historyList: [],
  selectedTask: null,
  isLoading: false,
  isDetailLoading: false,

  fetchHistory: async () => {
    set({ isLoading: true })
    try {
      const res = await fetch('/api/history')
      const json = await res.json()
      if (json.status === 'success') {
        set({ historyList: json.data || [], isLoading: false })
      } else {
        set({ isLoading: false })
      }
    } catch (e) {
      console.error('Fetch history failed', e)
      set({ isLoading: false })
    }
  },

  fetchDetail: async (taskId: string) => {
    set({ isDetailLoading: true })
    try {
      const res = await fetch(`/api/history/${taskId}`)
      const json = await res.json()
      if (json.status === 'success') {
        set({ selectedTask: json.data, isDetailLoading: false })
      } else {
        set({ isDetailLoading: false })
      }
    } catch (e) {
      console.error('Fetch detail failed', e)
      set({ isDetailLoading: false })
    }
  },

  deleteHistory: async (taskId: string) => {
    try {
      const res = await fetch(`/api/history/${taskId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.status === 'success') {
        set((state) => ({
          historyList: state.historyList.filter((h) => h.task_id !== taskId),
          selectedTask: state.selectedTask?.task_id === taskId ? null : state.selectedTask,
        }))
        return true
      }
    } catch (e) {
      console.error('Delete history failed', e)
    }
    return false
  },

  clearAllHistory: async () => {
    try {
      const res = await fetch('/api/history', { method: 'DELETE' })
      const json = await res.json()
      if (json.status === 'success') {
        set({ historyList: [], selectedTask: null })
        return true
      }
    } catch (e) {
      console.error('Clear all history failed', e)
    }
    return false
  },

  clearSelected: () => set({ selectedTask: null }),
}))
