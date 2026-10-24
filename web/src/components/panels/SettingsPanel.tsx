import React, { useState, useEffect, useRef } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { useConfigStore, Environment } from '@/stores/configStore'
import { useApiStore } from '@/stores/apiStore'
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

  const showToast = useApiStore((state) => state.showToast)

  const [selectedEnvId, setSelectedEnvId] = useState<string>('')
  const [formData, setFormData] = useState<Environment | null>(null)
  // 密钥默认直接显示掩码（type="text"），如需隐藏为圆点才切为 password 模式
  const [isPasswordMode, setIsPasswordMode] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

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

  // 当前域名匹配的官方地域标签
  const getMatchedRegionLabel = (domain: string) => {
    for (const r of OFFICIAL_REGIONS) {
      if (domain === r.primary) return `${r.name} · 主域名`
      if (domain === r.backup) return `${r.name} · 备域名`
    }
    return null
  }

  const matchedRegion = formData?.domain ? getMatchedRegionLabel(formData.domain) : null

  return (
    <div className="flex h-full flex-col bg-slate-50/60 dark:bg-slate-950 overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 py-3.5 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span>多环境配置与密钥安全管理</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            支持针对开发、测试、正式等多套腾讯云 IM 凭据配置，全链路自动脱敏防覆盖
          </p>
        </div>

        <div className="flex items-center gap-2">
          {formData && formData.id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => testConnection(formData.id)}
              disabled={isTesting}
              className="h-8 gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
              <span>{isTesting ? '测速联调中...' : '测试当前环境连通性'}</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !formData}
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
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/80 flex flex-col shrink-0 max-h-52 md:max-h-none">
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

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {environments.map((env) => {
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
                    <span>AppID: {env.sdkappid || '未设'}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans">
                      Admin: {env.admin_user}
                    </span>
                  </div>

                  {env.remark && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate">
                      {env.remark}
                    </p>
                  )}
                </div>
              )
            })}

            {isCreatingNew && (
              <div className="rounded-xl p-3 border-2 border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/30 text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>正在创建新环境草稿...</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Edit Environment Form */}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
  )
}
