import React, { useEffect, useState, useRef } from 'react'
import {
  Terminal,
  Layers,
  History,
  Settings,
  ShieldCheck,
  Activity,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Check,
  Server,
  Tag,
  Sliders,
  BookOpen,
  Sun,
  Moon,
  Bot,
  Sparkles,
  MessageSquare,
  Video,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useConfigStore, Environment } from '@/stores/configStore'
import { useApiStore, CLOUD_SERVICES } from '@/stores/apiStore'
import { useThemeStore } from '@/stores/themeStore'

interface HeaderProps {
  activeTab: 'sandbox' | 'docs' | 'batch' | 'agent' | 'settings'
  setActiveTab: (tab: 'sandbox' | 'docs' | 'batch' | 'agent' | 'settings') => void
}

export const getTagBadgeStyle = (tag: string) => {
  const upper = (tag || '').toUpperCase()
  if (upper === 'PROD' || upper.includes('生产') || upper.includes('正式')) {
    return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
  }
  if (upper === 'DEV' || upper.includes('开发') || upper.includes('沙箱')) {
    return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
  }
  if (upper === 'TEST' || upper.includes('测试')) {
    return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
  }
  if (upper === 'STAGE' || upper === 'PRE' || upper.includes('预发')) {
    return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
  }
  return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const {
    environments,
    activeEnvId,
    activeEnv,
    fetchEnvironments,
    switchEnvironment,
    isTesting,
    testResult,
    testConnection,
  } = useConfigStore()

  const { apis, activeServiceId, setActiveServiceId, showToast, cloudServices } = useApiStore()
  const availableServices = (cloudServices && cloudServices.length > 0) ? cloudServices : CLOUD_SERVICES
  const { isDark, toggleTheme } = useThemeStore()
  const [isEnvMenuOpen, setIsEnvMenuOpen] = useState(false)
  const [isServiceMenuOpen, setIsServiceMenuOpen] = useState(false)
  const envMenuRef = useRef<HTMLDivElement>(null)
  const serviceMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchEnvironments()
  }, [fetchEnvironments])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (envMenuRef.current && !envMenuRef.current.contains(event.target as Node)) {
        setIsEnvMenuOpen(false)
      }
      if (serviceMenuRef.current && !serviceMenuRef.current.contains(event.target as Node)) {
        setIsServiceMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeService = availableServices.find((s) => s.id === activeServiceId) || availableServices[0]
  const serviceApisCount = apis.filter((a) => (a.service_type || 'im') === activeService.id).length

  const handleSelectService = (serviceId: string) => {
    if (serviceId === activeServiceId) {
      setIsServiceMenuOpen(false)
      return
    }
    const target = availableServices.find((s) => s.id === serviceId)
    setActiveServiceId(serviceId)
    setIsServiceMenuOpen(false)
    showToast({
      type: 'success',
      message: `已切换全局服务至「${target?.name || serviceId}」`,
    }, 3000)
  }

  const handleSelectEnv = async (envId: string) => {
    if (envId === activeEnvId) {
      setIsEnvMenuOpen(false)
      return
    }
    const target = environments.find((e) => e.id === envId)
    const envName = target?.name || '指定环境'
    const ok = await switchEnvironment(envId)
    setIsEnvMenuOpen(false)
    if (ok) {
      showToast({
        type: 'success',
        message: `已切换全局运行环境至「${envName}」`,
      }, 3500)
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-3 sm:px-5 backdrop-blur-md transition-colors gap-2">
      {/* Brand logo & Workspace/Service Switcher Dropdown */}
      <div className="relative shrink-0" ref={serviceMenuRef}>
        <button
          type="button"
          onClick={() => setIsServiceMenuOpen(!isServiceMenuOpen)}
          className="group flex items-center gap-2 sm:gap-2.5 px-2 py-1 -ml-1 rounded-xl hover:bg-slate-100/90 dark:hover:bg-slate-800/80 transition-all cursor-pointer text-left border border-transparent hover:border-slate-200/80 dark:hover:border-slate-750"
          title="点击切换当前云产品工作台 (即时通信 IM / 云直播 CSS)"
        >
          {/* Logo App Icon with dynamic gradient */}
          <div
            className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-white shadow-md shrink-0 transition-transform group-hover:scale-105 ${
              activeService.id === 'live'
                ? 'bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-emerald-500/20'
                : 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/20'
            }`}
          >
            {activeService.id === 'live' ? (
              <Video className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Terminal className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </div>

          {/* Title, Badge & Dropdown Chevron */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
                TC Studio
              </span>
              <span className="hidden md:inline text-xs font-semibold text-slate-500 dark:text-slate-400">
                · {activeService.shortName || activeService.name}
              </span>
              <Badge
                variant="secondary"
                className={`font-mono text-[9px] px-1.5 py-0 border ${
                  activeService.id === 'live'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                    : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                }`}
              >
                {activeService.tag}
              </Badge>
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-transform duration-200 ${
                  isServiceMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
            <p className="hidden xl:block text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none mt-0.5">
              {activeService.id === 'live'
                ? `API 3.0 ${serviceApisCount || 261} 项官方树型全量覆盖 · 调试与签名引擎`
                : `REST API ${serviceApisCount || 166} 项官方树型全量覆盖 · 调试与批处理引擎`}
            </p>
          </div>
        </button>

        {/* Service Dropdown Menu Popup positioned directly under Logo */}
        {isServiceMenuOpen && (
          <div className="absolute left-0 top-full mt-2 w-76 sm:w-84 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-xl shadow-slate-900/10 dark:shadow-slate-950/60 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">切换云产品工作台 (Workspace)</span>
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                {availableServices.length} 个服务就绪
              </span>
            </div>

            <div className="py-1 space-y-1">
              {availableServices.map((service) => {
                const isActive = service.id === activeServiceId
                const count = apis.filter((a) => (a.service_type || 'im') === service.id).length
                const isLive = service.id === 'live'

                return (
                  <button
                    key={service.id}
                    onClick={() => handleSelectService(service.id)}
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer ${
                      isActive
                        ? isLive
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 border-l-2 border-l-emerald-500 font-medium'
                          : 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 border-l-2 border-l-blue-500 font-medium'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-4 shrink-0 flex items-center justify-center">
                        {isActive && (
                          <Check
                            className={`h-4 w-4 ${
                              isLive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-blue-600 dark:text-blue-400'
                            }`}
                          />
                        )}
                      </div>

                      <div
                        className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isLive
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                            : 'bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {isLive ? <Video className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold truncate text-slate-800 dark:text-slate-200">
                            {service.name}
                          </span>
                          <span
                            className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold border ${
                              isLive
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                            }`}
                          >
                            {service.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5">
                          {service.description}
                        </p>
                      </div>

                      <Badge variant="outline" className="font-mono text-[10px] shrink-0 ml-1">
                        {count} APIs
                      </Badge>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Center Navigation Tabs (桌面端 Apifox / Postman 风格导航，移动端收纳到底部栏) */}
      <nav className="hidden md:flex items-center gap-1 rounded-xl bg-slate-100/90 dark:bg-slate-950/70 p-1 border border-slate-200/60 dark:border-slate-800 shadow-inner shrink-0">
        <button
          onClick={() => setActiveTab('sandbox')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 cursor-pointer border ${
            activeTab === 'sandbox'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs dark:shadow-sm border-slate-200/60 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border-transparent'
          }`}
        >
          <Terminal className="h-3.5 w-3.5" />
          <span>接口调试</span>
        </button>

        <button
          onClick={() => setActiveTab('docs')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 cursor-pointer border ${
            activeTab === 'docs'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs dark:shadow-sm border-slate-200/60 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border-transparent'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>API 文档中心</span>
        </button>

        <button
          onClick={() => setActiveTab('batch')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 cursor-pointer border ${
            activeTab === 'batch'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs dark:shadow-sm border-slate-200/60 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border-transparent'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>批量调用</span>
        </button>

        <button
          onClick={() => setActiveTab('agent')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 cursor-pointer border ${
            activeTab === 'agent'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs dark:shadow-sm border-slate-200/60 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border-transparent'
          }`}
        >
          <Bot className="h-3.5 w-3.5 text-blue-500" />
          <span>AI 智能体</span>
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 cursor-pointer border ${
            activeTab === 'settings'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs dark:shadow-sm border-slate-200/60 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border-transparent'
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          <span>环境配置</span>
        </button>
      </nav>

      {/* Right status & tools */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Postman / Apifox 风格环境快速切换器 */}
        <div className="relative" ref={envMenuRef}>
          <div className="flex items-center rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-850 p-0.5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
            {/* Quick Environment Dropdown Trigger */}
            <button
              onClick={() => setIsEnvMenuOpen(!isEnvMenuOpen)}
              className="flex items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-750 transition-all cursor-pointer"
              title="切换当前工作环境"
            >
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${
                  testResult?.is_ok === true
                    ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                    : testResult?.is_ok === false
                    ? 'bg-rose-500'
                    : 'bg-emerald-500'
                }`}
              />

              {activeEnv?.tag && (
                <span
                  className={`px-1 sm:px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-mono font-bold border ${getTagBadgeStyle(
                    activeEnv.tag
                  )}`}
                >
                  {activeEnv.tag}
                </span>
              )}

              <span className="font-semibold text-slate-800 dark:text-slate-200 max-w-[70px] sm:max-w-[110px] truncate">
                {activeEnv?.name || '默认环境'}
              </span>

              <span className="hidden sm:inline font-mono text-[11px] text-slate-400 dark:text-slate-500">
                {activeEnv?.sdkappid ? `${activeEnv.sdkappid}` : '未配置'}
              </span>

              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
                  isEnvMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

            {/* Test Connectivity Button */}
            <button
              onClick={() => testConnection(undefined, activeServiceId)}
              disabled={isTesting}
              title={`测试当前环境的${activeService.name}通信与鉴权连接`}
              className="hidden sm:flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-white dark:hover:bg-slate-750 disabled:opacity-50 transition-all cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${isTesting ? 'animate-spin text-orange-600 dark:text-orange-400' : ''}`} />
              <span>
                {isTesting
                  ? '测速中...'
                  : testResult?.cost_ms !== undefined
                  ? `${testResult.cost_ms}ms`
                  : '测速'}
              </span>
            </button>
          </div>

          {/* Dropdown Menu Popup */}
          {isEnvMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-xl shadow-slate-900/10 dark:shadow-slate-950/60 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">切换工作环境</span>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                  {environments.length} 个可用环境
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto py-1 space-y-0.5">
                {environments.map((env) => {
                  const isActive = env.id === activeEnvId
                  return (
                    <button
                      key={env.id}
                      onClick={() => handleSelectEnv(env.id)}
                      className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 border-l-2 border-l-blue-500 font-medium'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-4 shrink-0 flex items-center justify-center">
                          {isActive && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold truncate text-slate-800 dark:text-slate-200">
                              {env.name}
                            </span>
                            {env.tag && (
                              <span
                                className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold border ${getTagBadgeStyle(
                                  env.tag
                                )}`}
                              >
                                {env.tag}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                            <span>AppID: {env.sdkappid || '未设'}</span>
                            {env.remark && (
                              <span className="text-slate-400 dark:text-slate-500 truncate max-w-[130px] font-sans">
                                · {env.remark}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-1 mt-1">
                <button
                  onClick={() => {
                    setIsEnvMenuOpen(false)
                    setActiveTab('settings')
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>管理多环境配置 & 标签</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme Mode Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? '当前为深色模式，点击切换为明亮模式' : '当前为明亮模式，点击切换为深色模式'}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-slate-750 transition-all cursor-pointer shadow-2xs"
        >
          {isDark ? (
            <Sun className="h-4 w-4 text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
          ) : (
            <Moon className="h-4 w-4 text-slate-600 hover:text-indigo-600 transition-transform duration-300" />
          )}
        </button>

        {/* Official Doc Link (大屏可见) */}
        <a
          href={activeService.docUrl || 'https://cloud.tencent.com/document'}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden lg:flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shrink-0"
        >
          <span>官方文档</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </header>
  )
}
