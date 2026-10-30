import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Settings,
  Shield,
  Key,
  Server,
  User,
  Clock,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Check,
  Tag as TagIcon,
  ShieldCheck,
  FileText,
  Radio,
  ExternalLink,
  Globe,
  X,
  Search,
  Video,
  MessageSquare,
  Cloud,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { useConfigStore, Environment } from '@/stores/configStore'
import { useApiStore, CLOUD_SERVICES } from '@/stores/apiStore'
import { getTagBadgeStyle } from '@/components/common/Header'

const PRESET_TAGS = ['PROD', 'DEV', 'TEST', 'STAGE', 'PRE']

export interface RegionDomainConfig {
  region: string
  name: string
  primary: string
  backup: string
}

export const OFFICIAL_REGIONS: RegionDomainConfig[] = [
  {
    region: 'china',
    name: '中国',
    primary: 'console.tim.qq.com',
    backup: 'adminapi.my-imcloud.com',
  },
  {
    region: 'singapore',
    name: '新加坡',
    primary: 'adminapisgp.im.qcloud.com',
    backup: 'adminapisgp.my-imcloud.com',
  },
  {
    region: 'seoul',
    name: '首尔',
    primary: 'adminapikr.im.qcloud.com',
    backup: 'adminapikr.my-imcloud.com',
  },
  {
    region: 'tokyo',
    name: '东京',
    primary: 'adminapijpn.im.qcloud.com',
    backup: 'adminapijpn.my-imcloud.com',
  },
  {
    region: 'frankfurt',
    name: '法兰克福',
    primary: 'adminapiger.im.qcloud.com',
    backup: 'adminapiger.my-imcloud.com',
  },
  {
    region: 'silicon_valley',
    name: '硅谷',
    primary: 'adminapiusa.im.qcloud.com',
    backup: 'adminapiusa.my-imcloud.com',
  },
  {
    region: 'jakarta',
    name: '雅加达',
    primary: 'adminapiidn.im.qcloud.com',
    backup: 'adminapiidn.my-imcloud.com',
  },
  {
    region: 'riyadh',
    name: '利雅得',
    primary: 'adminapiksa.im.qcloud.com',
    backup: 'adminapiksa.my-imcloud.com',
  },
]

export interface LiveRegionConfig {
  region: string
  name: string
  shortName: string
  endpoint: string
  isRecommended?: boolean
}

export const OFFICIAL_LIVE_REGIONS: LiveRegionConfig[] = [
  {
    region: 'ap-guangzhou',
    name: '就近地域接入（推荐，只支持非金融区）',
    shortName: '就近推荐',
    endpoint: 'live.tencentcloudapi.com',
    isRecommended: true,
  },
  {
    region: 'ap-guangzhou',
    name: '华南地区（广州）',
    shortName: '广州',
    endpoint: 'live.ap-guangzhou.tencentcloudapi.com',
  },
  {
    region: 'ap-shanghai',
    name: '华东地区（上海）',
    shortName: '上海',
    endpoint: 'live.ap-shanghai.tencentcloudapi.com',
  },
  {
    region: 'ap-nanjing',
    name: '华东地区（南京）',
    shortName: '南京',
    endpoint: 'live.ap-nanjing.tencentcloudapi.com',
  },
  {
    region: 'ap-beijing',
    name: '华北地区（北京）',
    shortName: '北京',
    endpoint: 'live.ap-beijing.tencentcloudapi.com',
  },
  {
    region: 'ap-chengdu',
    name: '西南地区（成都）',
    shortName: '成都',
    endpoint: 'live.ap-chengdu.tencentcloudapi.com',
  },
  {
    region: 'ap-chongqing',
    name: '西南地区（重庆）',
    shortName: '重庆',
    endpoint: 'live.ap-chongqing.tencentcloudapi.com',
  },
  {
    region: 'ap-hongkong',
    name: '港澳台地区（中国香港）',
    shortName: '中国香港',
    endpoint: 'live.ap-hongkong.tencentcloudapi.com',
  },
  {
    region: 'ap-singapore',
    name: '亚太东南（新加坡）',
    shortName: '新加坡',
    endpoint: 'live.ap-singapore.tencentcloudapi.com',
  },
  {
    region: 'ap-jakarta',
    name: '亚太东南（雅加达）',
    shortName: '雅加达',
    endpoint: 'live.ap-jakarta.tencentcloudapi.com',
  },
  {
    region: 'ap-bangkok',
    name: '亚太东南（曼谷）',
    shortName: '曼谷',
    endpoint: 'live.ap-bangkok.tencentcloudapi.com',
  },
  {
    region: 'ap-seoul',
    name: '亚太东北（首尔）',
    shortName: '首尔',
    endpoint: 'live.ap-seoul.tencentcloudapi.com',
  },
  {
    region: 'ap-tokyo',
    name: '亚太东北（东京）',
    shortName: '东京',
    endpoint: 'live.ap-tokyo.tencentcloudapi.com',
  },
  {
    region: 'na-ashburn',
    name: '美国东部（弗吉尼亚）',
    shortName: '弗吉尼亚',
    endpoint: 'live.na-ashburn.tencentcloudapi.com',
  },
  {
    region: 'na-siliconvalley',
    name: '美国西部（硅谷）',
    shortName: '硅谷',
    endpoint: 'live.na-siliconvalley.tencentcloudapi.com',
  },
  {
    region: 'sa-saopaulo',
    name: '南美地区（圣保罗）',
    shortName: '圣保罗',
    endpoint: 'live.sa-saopaulo.tencentcloudapi.com',
  },
  {
    region: 'eu-frankfurt',
    name: '欧洲地区（法兰克福）',
    shortName: '法兰克福',
    endpoint: 'live.eu-frankfurt.tencentcloudapi.com',
  },
]

export const SettingsPanel: React.FC = () => {
  const {
    environments,
    activeEnvId,
    activeEnv,
    isLoading,
    isSaving,
    isTesting,
    testResult,
    fetchEnvironments,
    switchEnvironment,
    saveEnvironment,
    deleteEnvironment,
    testConnection,
  } = useConfigStore()

  const { showToast, activeServiceId, setActiveServiceId, cloudServices } = useApiStore()
  const availableServices = (cloudServices && cloudServices.length > 0) ? cloudServices : CLOUD_SERVICES

  const [selectedEnvId, setSelectedEnvId] = useState<string>('')
  const [formData, setFormData] = useState<Environment | null>(null)
  // 当前正在配置的服务选项卡（默认与全局顶部选中的服务严格联动）
  const [activeServiceTab, setActiveServiceTab] = useState<string>(activeServiceId || 'im')
  const currentTabService = availableServices.find((s) => s.id === activeServiceTab) || availableServices[0]

  // 当全局服务切换时，配置面板自动同步切换对应视图
  useEffect(() => {
    if (activeServiceId) {
      setActiveServiceTab(activeServiceId)
    }
  }, [activeServiceId])

  const handleSwitchServiceTab = (serviceId: string) => {
    setActiveServiceTab(serviceId)
    setActiveServiceId(serviceId)
  }

  // 密钥默认直接显示掩码（type="text"），如需隐藏为圆点才切为 password 模式
  const [isPasswordMode, setIsPasswordMode] = useState(false)
  const [isTcPasswordMode, setIsTcPasswordMode] = useState(false)
  const [isLivePasswordMode, setIsLivePasswordMode] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  // 环境列表检索与 Tag 快捷过滤
  const [envSearch, setEnvSearch] = useState('')
  const [envTagFilter, setEnvTagFilter] = useState<'all' | string>('all')

  const availableEnvTags = useMemo(() => {
    const set = new Set<string>()
    environments.forEach((e) => {
      if (e.tag) set.add(e.tag.toUpperCase())
    })
    return Array.from(set)
  }, [environments])

  const sortedAndFilteredEnvs = useMemo(() => {
    let list = [...environments]
    if (envSearch.trim()) {
      const q = envSearch.trim().toLowerCase()
      list = list.filter((e) =>
        e.name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        (e.tag && e.tag.toLowerCase().includes(q)) ||
        (e.remark && e.remark.toLowerCase().includes(q))
      )
    }
    if (envTagFilter !== 'all') {
      list = list.filter((e) => (e.tag || '').toUpperCase() === envTagFilter)
    }
    // 优先置顶当前激活生效的环境
    list.sort((a, b) => {
      if (a.id === activeEnvId) return -1
      if (b.id === activeEnvId) return 1
      return 0
    })
    return list
  }, [environments, envSearch, envTagFilter, activeEnvId])

  const prevActiveEnvIdRef = useRef(activeEnvId)

  useEffect(() => {
    fetchEnvironments()
  }, [fetchEnvironments])

  // 1. 外部联动：当在顶部 Header 下拉菜单切换环境时，联动更新配置页的选择与表单
  useEffect(() => {
    if (!activeEnvId) return
    if (activeEnvId !== prevActiveEnvIdRef.current) {
      prevActiveEnvIdRef.current = activeEnvId
      setSelectedEnvId(activeEnvId)
      const found = environments.find((e) => e.id === activeEnvId)
      if (found) {
        setFormData({ ...found })
        setIsCreatingNew(false)
        setIsPasswordMode(false)
      }
    }
  }, [activeEnvId, environments])

  // 2. 初始化选择或保持选中的环境数据同步
  useEffect(() => {
    if (isCreatingNew) return

    // 初始加载：若 selectedEnvId 为空，优先选中 activeEnvId
    if (!selectedEnvId) {
      const initialId = (activeEnvId && environments.some((e) => e.id === activeEnvId))
        ? activeEnvId
        : environments[0]?.id || ''
      if (initialId) {
        setSelectedEnvId(initialId)
        prevActiveEnvIdRef.current = initialId
        const found = environments.find((e) => e.id === initialId)
        if (found) setFormData({ ...found })
      }
      return
    }

    // 已有选中的环境：保持当前 ID，并与 store 里的最新项同步
    const found = environments.find((e) => e.id === selectedEnvId)
    if (found) {
      setFormData((prev) => {
        if (prev?.id === found.id) {
          return { ...found }
        }
        return prev
      })
    } else if (environments.length > 0) {
      // 仅在当前环境被彻底删除时兜底
      const fallbackId = (activeEnvId && environments.some((e) => e.id === activeEnvId))
        ? activeEnvId
        : environments[0].id
      setSelectedEnvId(fallbackId)
      prevActiveEnvIdRef.current = fallbackId
      const fallbackEnv = environments.find((e) => e.id === fallbackId) || environments[0]
      setFormData({ ...fallbackEnv })
    }
  }, [environments, activeEnvId, selectedEnvId, isCreatingNew])

  const handleSelectEnv = (env: Environment) => {
    setIsCreatingNew(false)
    setSelectedEnvId(env.id)
    setFormData({ ...env })
    setIsPasswordMode(false)
    setFeedback(null)
  }

  const handleStartCreate = () => {
    setIsCreatingNew(true)
    setSelectedEnvId('')
    setFormData({
      id: '',
      name: `新环境 ${environments.length + 1}`,
      tag: 'DEV',
      remark: '新创建的环境配置',
      sdkappid: 0,
      secret_key: '',
      admin_user: 'administrator',
      domain: 'console.tim.qq.com',
      tc_secret_id: '',
      tc_secret_key: '',
      tc_region: 'ap-guangzhou',
      tc_endpoint: 'live.tencentcloudapi.com',
      live_push_domain: '',
      live_play_domain: '',
      live_push_key: '',
      live_play_key: '',
      delay_sec: 0.05,
    })
    setIsPasswordMode(false)
    setFeedback(null)
  }

  const handleSave = async () => {
    if (!formData) return
    if (!formData.name.trim()) {
      setFeedback({ type: 'error', message: '环境名称不能为空' })
      showToast({ type: 'warning', message: '环境名称不能为空' })
      return
    }

    const targetIdBeforeSave = formData.id
    const targetName = formData.name.trim()

    const res = await saveEnvironment(formData)
    if (res.success && res.data) {
      const savedEnv = res.data
      const newSelectedId = savedEnv.id || targetIdBeforeSave

      // 锁定并继续编辑当前保存的环境，绝不跳走
      setIsCreatingNew(false)
      setSelectedEnvId(newSelectedId)
      setFormData({ ...savedEnv })

      // 状态反馈
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 3500)

      const successMsg = `环境「${savedEnv.name || targetName}」配置已成功保存！`
      setFeedback({
        type: 'success',
        message: `${successMsg}（密钥已自动脱敏受保护）`,
      })
      setTimeout(() => setFeedback(null), 8000)

      showToast({
        type: 'success',
        message: `${successMsg}（密钥脱敏受保护）`,
      }, 5000)
    } else {
      const errorMsg = res.message || '保存失败，请检查配置参数'
      setFeedback({ type: 'error', message: errorMsg })
      showToast({ type: 'warning', message: errorMsg })
    }
  }

  const handleDelete = async (envId: string) => {
    if (environments.length <= 1) {
      setFeedback({ type: 'error', message: '至少保留一个环境配置，无法删除最后一个环境' })
      showToast({ type: 'warning', message: '至少保留一个环境配置，无法删除最后一个环境' })
      return
    }
    const target = environments.find((e) => e.id === envId)
    const name = target?.name || '该环境'
    if (!window.confirm(`确定要删除环境「${name}」配置吗？此操作不可逆。`)) return

    const res = await deleteEnvironment(envId)
    if (res.success) {
      setIsCreatingNew(false)
      const deleteMsg = `环境「${name}」配置已删除`
      setFeedback({ type: 'success', message: deleteMsg })
      setTimeout(() => setFeedback(null), 3000)
      showToast({ type: 'info', message: deleteMsg })
    } else {
      const errorMsg = res.message || '删除失败'
      setFeedback({ type: 'error', message: errorMsg })
      showToast({ type: 'warning', message: errorMsg })
    }
  }

  const isCurrentActive = formData?.id === activeEnvId
  const isMaskedSecret = formData?.secret_key && (formData.secret_key.includes('*') || formData.secret_key.includes('•'))
  const isMaskedTcSecret = formData?.tc_secret_key && (formData.tc_secret_key.includes('*') || formData.tc_secret_key.includes('•'))
  const isMaskedPushKey = formData?.live_push_key && (formData.live_push_key.includes('*') || formData.live_push_key.includes('•'))
  const isMaskedPlayKey = formData?.live_play_key && (formData.live_play_key.includes('*') || formData.live_play_key.includes('•'))

  // 当前域名匹配的官方地域标签
  const getMatchedRegionLabel = (domain: string) => {
    for (const r of OFFICIAL_REGIONS) {
      if (domain === r.primary) return `${r.name} · 主域名`
      if (domain === r.backup) return `${r.name} · 备域名`
    }
    return null
  }

  const matchedRegion = formData?.domain ? getMatchedRegionLabel(formData.domain) : null

  // 当前云直播接入地域与域名匹配的官方地域标签
  const getMatchedLiveRegionLabel = (endpoint?: string, region?: string) => {
    if (endpoint) {
      const foundByEndpoint = OFFICIAL_LIVE_REGIONS.find((r) => r.endpoint === endpoint)
      if (foundByEndpoint) return foundByEndpoint.name
    }
    if (region) {
      const foundByRegion = OFFICIAL_LIVE_REGIONS.find((r) => r.region === region && !r.isRecommended)
      if (foundByRegion) return foundByRegion.name
    }
    return null
  }

  const matchedLiveRegion = getMatchedLiveRegionLabel(formData?.tc_endpoint, formData?.tc_region)

  return (
    <div className="flex h-full flex-col bg-slate-50/60 dark:bg-slate-950 overflow-hidden">
      {/* Prominent Global Top Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between border-b px-6 py-2.5 text-xs font-semibold transition-all shrink-0 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5 rounded hover:bg-slate-200/50 dark:hover:bg-slate-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Column: Environment List */}
        <div className="w-full md:w-72 lg:w-80 border-b md:border-b-0 md:border-r border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/80 flex flex-col shrink-0 max-h-52 md:max-h-none">
          <div className="flex items-center justify-between p-3.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">环境清单</span>
              <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full font-semibold">
                {environments.length}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleStartCreate}
              className="h-7 px-2 text-[11px] gap-1 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50/60 dark:hover:bg-blue-950/50 cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <span>新建环境</span>
            </Button>
          </div>

          {/* 环境搜索与 Tag 快捷筛选 */}
          <div className="px-2.5 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-1.5">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="搜索环境名称或标识..."
                value={envSearch}
                onChange={(e) => setEnvSearch(e.target.value)}
                className="w-full h-7 pl-8 pr-6 text-xs rounded-lg border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {envSearch && (
                <button
                  type="button"
                  onClick={() => setEnvSearch('')}
                  className="absolute right-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Tag 快捷过滤药丸 */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-thin text-[10px]">
              <button
                type="button"
                onClick={() => setEnvTagFilter('all')}
                className={`px-2 py-0.5 rounded-md font-semibold shrink-0 cursor-pointer transition-colors ${
                  envTagFilter === 'all'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                全部
              </button>
              {availableEnvTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setEnvTagFilter(tag)}
                  className={`px-2 py-0.5 rounded-md font-mono font-bold shrink-0 cursor-pointer transition-colors ${
                    envTagFilter === tag
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {sortedAndFilteredEnvs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                未找到匹配的环境配置
              </div>
            ) : (
              sortedAndFilteredEnvs.map((env) => {
              const isSelected = !isCreatingNew && env.id === selectedEnvId
              const isActive = env.id === activeEnvId

              return (
                <div
                  key={env.id}
                  onClick={() => handleSelectEnv(env)}
                  className={`group relative rounded-xl p-3 border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {env.name}
                      </span>
                      {env.tag && (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${getTagBadgeStyle(
                            env.tag
                          )}`}
                        >
                          {env.tag}
                        </span>
                      )}
                    </div>

                    {isActive ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        生效中
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation()
                          await switchEnvironment(env.id)
                          showToast({
                            type: 'success',
                            message: `已切换全局运行环境至「${env.name}」`,
                          })
                        }}
                        className="opacity-0 group-hover:opacity-100 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-all cursor-pointer"
                        title="设为全局当前生效环境"
                      >
                        设为生效
                      </button>
                    )}
                  </div>

                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    {activeServiceTab === 'live' ? (
                      <>
                        <span className="truncate max-w-[125px]">
                          SecretId: {env.tc_secret_id ? `${env.tc_secret_id.slice(0, 8)}...` : '未配置'}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans shrink-0">
                          {env.tc_region || 'ap-guangzhou'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>AppID: {env.sdkappid || '未设'}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans">
                          Admin: {env.admin_user || 'administrator'}
                        </span>
                      </>
                    )}
                  </div>

                  {env.remark && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate">
                      {env.remark}
                    </p>
                  )}
                </div>
              )
            }))}

            {isCreatingNew && (
              <div className="rounded-xl p-3 border-2 border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/30 text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>正在创建新环境草稿...</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Edit Environment Form */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Form Header Toolbar (紧凑表单工具条，与左侧环境清单栏顶对齐) */}
          <div className="shrink-0 px-3 sm:px-6 py-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-h-[48px]">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                {isCreatingNew ? '新建运行环境草稿' : `配置环境: ${formData?.name || '未命名'}`}
              </span>
              {formData?.tag && (
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border shrink-0 ${getTagBadgeStyle(formData.tag)}`}>
                  {formData.tag}
                </span>
              )}
              {formData?.id === activeEnvId && !isCreatingNew && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 whitespace-nowrap shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  当前生效
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {formData && formData.id && !isCreatingNew && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection(formData.id, activeServiceTab)}
                  disabled={isTesting}
                  className="h-8 gap-1.5 text-xs text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-750 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer shadow-2xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
                  <span>
                    {isTesting ? (
                      '测试中...'
                    ) : (
                      <>
                        <span className="hidden sm:inline">{`测试「${currentTabService?.name || (activeServiceTab === 'live' ? '云直播' : 'IM')}」连通性`}</span>
                        <span className="sm:hidden">测试连通</span>
                      </>
                    )}
                  </span>
                </Button>
              )}

              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !formData}
                className={`h-8 gap-1.5 text-xs transition-all cursor-pointer font-semibold shadow-xs ${
                  justSaved
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                }`}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>正在保存...</span>
                  </>
                ) : justSaved ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                    <span>已保存成功！</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>
                      <span className="hidden sm:inline">保存环境配置</span>
                      <span className="sm:hidden">保存</span>
                    </span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Test Result Banner */}
          {testResult && (
            <div
              className={`rounded-xl p-4 text-xs flex items-center justify-between border ${
                testResult.is_ok
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {testResult.is_ok ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <div>
                  <p className="font-bold">
                    {testResult.is_ok ? '腾讯云通信正常 · 鉴权通过' : '通信或鉴权连接失败'}
                  </p>
                  <p className="text-[11px] opacity-80 mt-0.5">{testResult.message}</p>
                </div>
              </div>

              {testResult.cost_ms !== undefined && (
                <Badge variant="outline" className="font-mono bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
                  耗时: {testResult.cost_ms}ms
                </Badge>
              )}
            </div>
          )}

          {formData ? (
            <div className="space-y-5 w-full">
              {/* Security Protection Notice */}
              <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center shrink-0 text-blue-700 dark:text-blue-400 mt-0.5">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>密钥安全防覆盖保护机制</span>
                      <Badge variant="secondary" className="font-mono text-[9px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                        脱敏就绪
                      </Badge>
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      环境配置中的 SecretKey 默认以掩码脱敏呈现（如 <span className="font-mono font-semibold">ca3e****c364</span>）。
                      若您未输入新密钥（保留脱敏掩码或留空），保存时<span className="font-semibold text-blue-800 dark:text-blue-300">系统绝不会用掩码覆盖原有的真实密钥</span>，保障凭证永不丢失。如需更新密钥，直接清空输入框并粘贴新的 64 位密钥即可。
                    </p>
                  </div>
                </div>
              </div>

              {/* Basic Info & Tagging Card */}
              <Card className="border-slate-200/90 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
                <CardHeader className="pb-3 pt-4 px-5">
                  <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <TagIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span>环境基本信息与标签分类</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    为该环境配置便于团队辨识的名称、分类标签与说明
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 px-5 pb-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <span>环境名称</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="例如: 生产正式环境 / 开发联调沙箱"
                        className="bg-white dark:bg-slate-800 text-xs font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        环境标签 (Tag)
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={formData.tag}
                          onChange={(e) => setFormData({ ...formData, tag: e.target.value.toUpperCase() })}
                          placeholder="例如: PROD, DEV, TEST"
                          className="bg-white dark:bg-slate-800 font-mono text-xs font-semibold uppercase"
                        />
                        <div className="flex items-center gap-1">
                          {PRESET_TAGS.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setFormData({ ...formData, tag })}
                              className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                                formData.tag === tag
                                  ? `${getTagBadgeStyle(tag)} ring-2 ring-blue-400 ring-offset-1`
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      环境备注与用途说明 (Remark)
                    </label>
                    <Input
                      value={formData.remark}
                      onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                      placeholder="例如: 腾讯云即时通信 IM 正式生产集群，仅运维团队管理员操作"
                      className="bg-white dark:bg-slate-800 text-xs"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 服务凭据专属切换栏 (动态由 SSoT 云服务清单驱动，支持多业务自由扩展) */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3 shadow-2xs">
                <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-750 shadow-2xs">
                  {availableServices.map((srv) => {
                    const isTabActive = activeServiceTab === srv.id
                    const isConfigured = srv.id === 'im'
                      ? Boolean(formData.sdkappid && formData.secret_key)
                      : Boolean(formData.tc_secret_id && formData.tc_secret_key)

                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => handleSwitchServiceTab(srv.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isTabActive
                            ? srv.id === 'live'
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {srv.id === 'live' ? (
                          <Video className="h-3.5 w-3.5" />
                        ) : srv.id === 'im' ? (
                          <MessageSquare className="h-3.5 w-3.5" />
                        ) : (
                          <Cloud className="h-3.5 w-3.5" />
                        )}
                        <span>{srv.name} 凭据</span>
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isConfigured
                              ? 'bg-emerald-400 ring-2 ring-emerald-400/30'
                              : 'bg-slate-300 dark:bg-slate-500'
                          }`}
                        />
                      </button>
                    )
                  })}
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${activeServiceTab === 'live' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                  <span className="shrink-0 whitespace-nowrap">当前处于：</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0">
                    {currentTabService?.name || (activeServiceTab === 'live' ? '云直播 (CSS)' : '即时通信 IM')} 独立配置
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">（其余服务配置已按需收纳）</span>
                </div>
              </div>

              {/* 当处于 IM 服务时：仅渲染 IM 基础鉴权与网关域名配置 */}
              {activeServiceTab === 'im' && (
                <>
                  {/* Tencent Cloud IM Credentials */}
              <Card className="border-slate-200/90 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
                <CardHeader className="pb-3 pt-4 px-5">
                  <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span>腾讯云 IM 基础鉴权凭证</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    在 腾讯云即时通信 IM 控制台 &gt; 应用管理 &gt; 基本配置 中获取
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 px-5 pb-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <span>SDKAppID (应用编号)</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        type="number"
                        value={formData.sdkappid || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, sdkappid: parseInt(e.target.value) || 0 })
                        }
                        placeholder="例如: 1400000000"
                        className="font-mono bg-white dark:bg-slate-800 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <span>管理员账号 (UserID)</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        value={formData.admin_user}
                        onChange={(e) =>
                          setFormData({ ...formData, admin_user: e.target.value })
                        }
                        placeholder="administrator"
                        className="font-mono bg-white dark:bg-slate-800 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Key className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                        <span>SecretKey (64 位加密私钥)</span>
                        {isMaskedSecret ? (
                          <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 font-mono py-0">
                            脱敏掩码保护中
                          </Badge>
                        ) : formData.secret_key ? (
                          <Badge variant="outline" className="text-[10px] text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 font-mono py-0">
                            输入新密钥
                          </Badge>
                        ) : null}
                      </label>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIsPasswordMode(!isPasswordMode)}
                          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 text-[11px] font-normal cursor-pointer"
                        >
                          {isPasswordMode ? (
                            <>
                              <Eye className="h-3 w-3" /> 显示脱敏掩码
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3" /> 隐藏为密文点号
                            </>
                          )}
                        </button>

                        {isMaskedSecret && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, secret_key: '' })
                              setIsPasswordMode(false)
                            }}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-[11px] font-medium cursor-pointer"
                          >
                            更换新密钥
                          </button>
                        )}
                      </div>
                    </div>

                    <Input
                      type={isPasswordMode ? 'password' : 'text'}
                      value={formData.secret_key}
                      onChange={(e) =>
                        setFormData({ ...formData, secret_key: e.target.value })
                      }
                      placeholder={isMaskedSecret ? formData.secret_key : "粘贴 64 位十六进制密钥"}
                      className="font-mono bg-white dark:bg-slate-800 text-xs tracking-wider"
                    />
                    <p className="text-[11px] text-slate-400">
                      默认以明文掩码展示（如 ca3e****c364）。非必要无需变更；若保持脱敏掩码原样保存，系统绝不会用掩码覆盖原真实密钥。
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Gateway & Network Options (官方多地域域名选择) */}
              <Card className="border-slate-200/90 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
                <CardHeader className="pb-3 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Server className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <span>网关域名与调度参数</span>
                    </CardTitle>
                    {matchedRegion && (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 font-medium">
                        当前节点: {matchedRegion}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs text-slate-400">
                    支持按腾讯云官方国内及海外数据中心地域快速选择主备接入域名
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 px-5 pb-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                        <span>IM REST API 接入域名 (Domain)</span>
                      </label>
                      <span className="text-[11px] text-slate-400">
                        选择官方预设或直接编辑自定义域名
                      </span>
                    </div>

                    {/* 下拉选择器与直接输入框组合 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <select
                        value={formData.domain}
                        onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono text-slate-800 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <option value="" disabled>-- 快速选择腾讯云官方节点域名 --</option>
                        {OFFICIAL_REGIONS.map((r) => (
                          <optgroup key={r.region} label={`📍 ${r.name}`}>
                            <option value={r.primary}>{r.name} · 主域名 ({r.primary})</option>
                            <option value={r.backup}>{r.name} · 备域名 ({r.backup})</option>
                          </optgroup>
                        ))}
                      </select>

                      <Input
                        value={formData.domain}
                        onChange={(e) =>
                          setFormData({ ...formData, domain: e.target.value })
                        }
                        placeholder="例如: console.tim.qq.com"
                        className="font-mono bg-white dark:bg-slate-800 text-xs h-9"
                      />
                    </div>

                    {/* 官方地域快速选择标签组 */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[11px] text-slate-400 mr-0.5">常用地域快捷填选:</span>
                      {OFFICIAL_REGIONS.map((r) => {
                        const isPrimary = formData.domain === r.primary
                        const isBackup = formData.domain === r.backup
                        return (
                          <div
                            key={r.region}
                            className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 shadow-2xs text-[11px]"
                          >
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, domain: r.primary })}
                              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                                isPrimary
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                              title={`${r.name}主域名: ${r.primary}`}
                            >
                              {r.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, domain: r.backup })}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer border-l border-slate-100 dark:border-slate-700 ${
                                isBackup
                                  ? 'bg-indigo-600 text-white font-semibold'
                                  : 'text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                              title={`${r.name}备域名: ${r.backup}`}
                            >
                              备
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      批处理调度流控间隔 (秒)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.delay_sec}
                      onChange={(e) =>
                        setFormData({ ...formData, delay_sec: parseFloat(e.target.value) || 0.05 })
                      }
                      placeholder="0.05"
                      className="font-mono bg-white dark:bg-slate-800 text-xs max-w-xs"
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* 当处于非 IM 服务（如云直播 CSS、TRTC、VOD 等）时：渲染 API 3.0 通用凭证与业务专属配置 */}
          {activeServiceTab !== 'im' && (
            <>
              {/* 腾讯云 API 3.0 通用凭据与当前云产品配置 */}
              <Card className="border-slate-200/90 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
                <CardHeader className="pb-3 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Video className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>腾讯云 API 3.0 通用凭据 & {currentTabService?.name || '云产品配置'}</span>
                    </CardTitle>
                    {matchedLiveRegion ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 font-medium">
                        当前节点: {matchedLiveRegion}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 font-medium">
                        通用扩展
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs text-slate-400">
                    配置腾讯云 CAM 访问密钥 (SecretId / SecretKey) 与 API 接入地域，即可调度云直播 (CSS) 等全量 API 3.0 云服务。
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 px-5 pb-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <span>SecretId (CAM 密钥标识)</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        value={formData.tc_secret_id || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, tc_secret_id: e.target.value.trim() })
                        }
                        placeholder="例如: AKIDxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="font-mono bg-white dark:bg-slate-800 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Key className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                          <span>SecretKey (API 3.0 访问密钥)</span>
                          <span className="text-rose-500">*</span>
                          {isMaskedTcSecret && (
                            <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 font-mono py-0">
                              脱敏掩码保护中
                            </Badge>
                          )}
                        </label>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setIsTcPasswordMode(!isTcPasswordMode)}
                            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 text-[11px] font-normal cursor-pointer"
                          >
                            {isTcPasswordMode ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            {isTcPasswordMode ? '显示脱敏掩码' : '隐藏密文'}
                          </button>
                        </div>
                      </div>

                      <Input
                        type={isTcPasswordMode ? 'password' : 'text'}
                        value={formData.tc_secret_key || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, tc_secret_key: e.target.value.trim() })
                        }
                        placeholder={isMaskedTcSecret ? formData.tc_secret_key : "粘贴腾讯云 API 访问密钥 SecretKey"}
                        className="font-mono bg-white dark:bg-slate-800 text-xs tracking-wider"
                      />
                    </div>
                  </div>

                  {/* 云直播 API 3.0 接入地域与专属域名 (官方 17 地域下拉选择与快速填选) */}
                  <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between pt-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                        <span>云直播 API 3.0 接入地域与域名 (Region & Endpoint)</span>
                      </label>
                      <span className="text-[11px] text-slate-400">
                        支持就近接入或定向调度全球 17 个官方节点
                      </span>
                    </div>

                    {/* 下拉选择器与双输入框组合 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 lg:col-span-3">
                        <select
                          value={formData.tc_endpoint || 'live.tencentcloudapi.com'}
                          onChange={(e) => {
                            const selectedEndpoint = e.target.value
                            const matched = OFFICIAL_LIVE_REGIONS.find((r) => r.endpoint === selectedEndpoint)
                            setFormData({
                              ...formData,
                              tc_endpoint: selectedEndpoint,
                              ...(matched ? { tc_region: matched.region } : {}),
                            })
                          }}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono text-slate-800 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <option value="" disabled>-- 快速选择腾讯云官方接入地域与域名 --</option>
                          {OFFICIAL_LIVE_REGIONS.map((r) => (
                            <option key={r.endpoint} value={r.endpoint}>
                              {r.name}（{r.endpoint}）
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400">地域标识 (Region)</label>
                        <Input
                          value={formData.tc_region || 'ap-guangzhou'}
                          onChange={(e) => setFormData({ ...formData, tc_region: e.target.value.trim() })}
                          placeholder="ap-guangzhou"
                          className="font-mono bg-white dark:bg-slate-800 text-xs"
                        />
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[11px] text-slate-400">API 接入域名 (Endpoint)</label>
                        <Input
                          value={formData.tc_endpoint || 'live.tencentcloudapi.com'}
                          onChange={(e) => setFormData({ ...formData, tc_endpoint: e.target.value.trim() })}
                          placeholder="live.tencentcloudapi.com"
                          className="font-mono bg-white dark:bg-slate-800 text-xs"
                        />
                      </div>
                    </div>

                    {/* 常用地域快速标签 */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-400 mr-0.5">常用地域快捷填选:</span>
                      {OFFICIAL_LIVE_REGIONS.slice(0, 10).map((r) => {
                        const isSelected = (formData.tc_endpoint === r.endpoint) || (!formData.tc_endpoint && r.isRecommended)
                        return (
                          <button
                            key={r.endpoint}
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                tc_region: r.region,
                                tc_endpoint: r.endpoint,
                              })
                            }
                            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer border ${
                              isSelected
                                ? 'bg-emerald-600 text-white font-semibold border-emerald-600 shadow-2xs'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                            title={`${r.name} · ${r.endpoint}`}
                          >
                            {r.shortName}
                          </button>
                        )
                      })}
                    </div>

                    {/* 官方地域与接入点使用指南提示条 */}
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-750 p-2.5 text-[11px] text-slate-500 dark:text-slate-400 space-y-1 mt-2">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span>腾讯云官方服务地址接入规则：</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-[10px] pl-1 leading-relaxed">
                        <li>
                          <strong className="text-slate-600 dark:text-slate-300">就近地域接入（推荐）：</strong>
                          默认域名 <code className="font-mono text-emerald-600 dark:text-emerald-400">live.tencentcloudapi.com</code> 会根据客户端位置自动解析到最近的服务器（只支持非金融区）。
                        </li>
                        <li>
                          <strong className="text-slate-600 dark:text-slate-300">时延敏感业务：</strong>
                          建议直接指定带地域的域名（如华南广州 <code className="font-mono text-emerald-600 dark:text-emerald-400">live.ap-guangzhou.tencentcloudapi.com</code>），消除自动解析调度的网络开销。
                        </li>
                        <li>
                          <strong className="text-slate-600 dark:text-slate-300">接入点 vs 业务地域：</strong>
                          域名是 API 接入网关，并不代表产品或接口实际提供服务的地域。业务支持的地域请查阅各接口入参要求。
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* 云直播专属防盗链 Key 与推拉流域名 (仅在云直播选项卡下展开) */}
                  {activeServiceTab === 'live' && (
                    <div className="border-t border-slate-200/80 dark:border-slate-800 pt-3 space-y-3">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <span>云直播 (CSS) 推拉流域名与防盗链鉴权 Key</span>
                        <span className="text-[10px] font-normal text-slate-400">(用于一键生成防盗链推流/播放地址)</span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] text-slate-500 dark:text-slate-400">
                            推流域名 (Push Domain)
                          </label>
                          <Input
                            value={formData.live_push_domain || ''}
                            onChange={(e) =>
                              setFormData({ ...formData, live_push_domain: e.target.value.trim() })
                            }
                            placeholder="例如: push.yourdomain.com"
                            className="font-mono bg-white dark:bg-slate-800 text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] text-slate-500 dark:text-slate-400">
                            播放域名 (Play Domain)
                          </label>
                          <Input
                            value={formData.live_play_domain || ''}
                            onChange={(e) =>
                              setFormData({ ...formData, live_play_domain: e.target.value.trim() })
                            }
                            placeholder="例如: play.yourdomain.com"
                            className="font-mono bg-white dark:bg-slate-800 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] text-slate-500 dark:text-slate-400">
                            推流防盗链 Key (txSecret 计算密钥)
                          </label>
                          <Input
                            type={isLivePasswordMode ? 'password' : 'text'}
                            value={formData.live_push_key || ''}
                            onChange={(e) =>
                              setFormData({ ...formData, live_push_key: e.target.value.trim() })
                            }
                            placeholder={isMaskedPushKey ? formData.live_push_key : "腾讯云直播控制台获取的推流防盗链 Key"}
                            className="font-mono bg-white dark:bg-slate-800 text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] text-slate-500 dark:text-slate-400">
                            播放防盗链 Key (可选)
                          </label>
                          <Input
                            type={isLivePasswordMode ? 'password' : 'text'}
                            value={formData.live_play_key || ''}
                            onChange={(e) =>
                              setFormData({ ...formData, live_play_key: e.target.value.trim() })
                            }
                            placeholder={isMaskedPlayKey ? formData.live_play_key : "可选，播放防盗链 Key"}
                            className="font-mono bg-white dark:bg-slate-800 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  {formData.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(formData.id)}
                      className="h-8 gap-1.5 text-xs text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>删除此环境</span>
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`h-8 gap-1.5 text-xs transition-all cursor-pointer ${
                      justSaved
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-500/20'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs shadow-blue-500/20'
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>正在保存...</span>
                      </>
                    ) : justSaved ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                        <span>已保存成功！</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>保存环境配置</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Settings className="h-10 w-10 stroke-1 mb-2" />
              <p className="text-xs">请在左侧选择或新建一个运行环境</p>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
