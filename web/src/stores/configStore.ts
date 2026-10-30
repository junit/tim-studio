import { create } from 'zustand'

export interface Environment {
  id: string
  name: string
  tag: string
  remark: string
  sdkappid: number
  secret_key: string
  admin_user: string
  domain: string
  delay_sec: number
  has_secret?: boolean
  tc_secret_id?: string
  tc_secret_key?: string
  tc_region?: string
  tc_endpoint?: string
  live_push_domain?: string
  live_play_domain?: string
  live_push_key?: string
  live_play_key?: string
  has_tc_secret?: boolean
}

export interface TimConfig {
  sdkappid: number
  secret_key: string
  admin_user: string
  domain: string
  delay_sec: number
  tc_secret_id?: string
  tc_secret_key?: string
  tc_region?: string
  tc_endpoint?: string
  live_push_domain?: string
  live_play_domain?: string
  live_push_key?: string
  live_play_key?: string
}

interface ConfigState {
  environments: Environment[]
  activeEnvId: string
  activeEnv: Environment | null
  config: TimConfig
  isLoading: boolean
  isSaving: boolean
  isTesting: boolean
  testResult: {
    is_ok: boolean
    cost_ms?: number
    message?: string
  } | null

  fetchEnvironments: () => Promise<void>
  fetchConfig: () => Promise<void>
  switchEnvironment: (envId: string) => Promise<boolean>
  saveEnvironment: (env: Partial<Environment>) => Promise<{ success: boolean; data?: Environment; message?: string }>
  deleteEnvironment: (envId: string) => Promise<{ success: boolean; message?: string }>
  updateConfig: (cfg: Partial<TimConfig>) => Promise<boolean>
  testConnection: (envId?: string, service?: string) => Promise<void>
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  environments: [],
  activeEnvId: '',
  activeEnv: null,
  config: {
    sdkappid: 0,
    secret_key: '',
    admin_user: 'administrator',
    domain: 'console.tim.qq.com',
    delay_sec: 0.05,
  },
  isLoading: false,
  isSaving: false,
  isTesting: false,
  testResult: null,

  fetchEnvironments: async () => {
    set({ isLoading: true })
    try {
      const res = await fetch('/api/environments')
      const json = await res.json()
      if (json.status === 'success' && json.data) {
        const { active_env_id, active_env, environments } = json.data
        set({
          environments: environments || [],
          activeEnvId: active_env_id || '',
          activeEnv: active_env || null,
          config: active_env ? {
            sdkappid: active_env.sdkappid,
            secret_key: active_env.secret_key,
            admin_user: active_env.admin_user,
            domain: active_env.domain,
            delay_sec: active_env.delay_sec,
            tc_secret_id: active_env.tc_secret_id,
            tc_secret_key: active_env.tc_secret_key,
            tc_region: active_env.tc_region,
            live_push_domain: active_env.live_push_domain,
            live_play_domain: active_env.live_play_domain,
            live_push_key: active_env.live_push_key,
            live_play_key: active_env.live_play_key,
          } : get().config,
          isLoading: false,
        })
      } else {
        set({ isLoading: false })
      }
    } catch (e) {
      console.error('Fetch environments failed', e)
      set({ isLoading: false })
    }
  },

  fetchConfig: async () => {
    // Calling fetchEnvironments keeps both environments and config synchronized
    await get().fetchEnvironments()
  },

  switchEnvironment: async (envId: string) => {
    try {
      const res = await fetch('/api/environments/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ env_id: envId }),
      })
      const json = await res.json()
      if (json.status === 'success') {
        await get().fetchEnvironments()
        return true
      }
    } catch (e) {
      console.error('Switch environment failed', e)
    }
    return false
  },

  saveEnvironment: async (envData: Partial<Environment>) => {
    set({ isSaving: true })
    try {
      const res = await fetch('/api/environments/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envData),
      })
      const json = await res.json()
      if (json.status === 'success') {
        await get().fetchEnvironments()
        set({ isSaving: false })
        return { success: true, data: json.data }
      } else {
        set({ isSaving: false })
        return { success: false, message: json.message || '保存失败' }
      }
    } catch (e: any) {
      console.error('Save environment failed', e)
      set({ isSaving: false })
      return { success: false, message: e.message || '网络请求异常' }
    }
  },

  deleteEnvironment: async (envId: string) => {
    try {
      const res = await fetch(`/api/environments/${envId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.status === 'success') {
        await get().fetchEnvironments()
        return { success: true }
      } else {
        return { success: false, message: json.message || '删除失败' }
      }
    } catch (e: any) {
      return { success: false, message: e.message || '网络请求异常' }
    }
  },

  updateConfig: async (partialCfg: Partial<TimConfig>) => {
    // If activeEnv exists, save to activeEnv
    const currentActive = get().activeEnv
    if (currentActive) {
      const updated = {
        ...currentActive,
        ...partialCfg,
      }
      const res = await get().saveEnvironment(updated)
      return res.success
    }

    // Fallback to legacy /api/config
    const newConfig = { ...get().config, ...partialCfg }
    set({ isSaving: true })
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      })
      const json = await res.json()
      if (json.status === 'success') {
        await get().fetchEnvironments()
        set({ isSaving: false })
        return true
      }
    } catch (e) {
      console.error('Save config failed', e)
    } finally {
      set({ isSaving: false })
    }
    return false
  },

  testConnection: async (envId?: string, service?: string) => {
    set({ isTesting: true, testResult: null })
    try {
      const res = await fetch('/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(envId ? { env_id: envId } : {}),
          ...(service ? { service } : {}),
        }),
      })
      const json = await res.json()
      set({
        isTesting: false,
        testResult: {
          is_ok: json.is_ok ?? false,
          cost_ms: json.cost_ms,
          message: json.message || (json.is_ok ? '通信正常，鉴权通过' : '连接或鉴权失败'),
        },
      })
    } catch (e: any) {
      set({
        isTesting: false,
        testResult: {
          is_ok: false,
          message: e.message || '网络请求异常',
        },
      })
    }
  },
}))
