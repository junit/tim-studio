import React, { useState, useEffect, useMemo } from 'react'
import {
  Layers,
  Search,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  ShieldAlert,
  FileCode,
  Globe,
  Server,
  Key,
  Database,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Info,
  CheckCircle2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { JsonCodeEditor } from '@/components/common/JsonCodeEditor'
import { useApiStore } from '@/stores/apiStore'

export const CommonSpecsViewer: React.FC = () => {
  const { showToast, activeServiceId } = useApiStore()

  const [loading, setLoading] = useState<boolean>(true)
  const [specs, setSpecs] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'invocation' | 'structs' | 'errors' | 'mappings'>('invocation')
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // 数据结构检索状态
  const [structSearch, setStructSearch] = useState<string>('')
  const [selectedStructName, setSelectedStructName] = useState<string>('CommonMixOutputParams')

  // 错误码检索状态
  const [errorSearch, setErrorSearch] = useState<string>('')
  const [errorScopeFilter, setErrorScopeFilter] = useState<'all' | 'global' | 'business'>('all')

  // 映射表检索状态
  const [mappingTab, setMappingTab] = useState<'countries' | 'provinces' | 'isps'>('countries')
  const [mappingSearch, setMappingSearch] = useState<string>('')

  // 调用方式子页面
  const [invocationSection, setInvocationSection] = useState<'request' | 'headers' | 'sig3' | 'response' | 'types'>('request')

  const fetchSpecs = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/common-specs?service=${activeServiceId}`)
      const json = await res.json()
      if (json.status === 'success') {
        setSpecs(json.data)
      }
    } catch (e) {
      console.error('Failed to fetch common specs', e)
      showToast({ type: 'error', message: '获取公共规范失败' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSpecs()
  }, [activeServiceId])

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    showToast({ type: 'success', message: '已复制到剪贴板' })
    setTimeout(() => setCopiedKey(null), 1500)
  }

  const handleSyncSpecs = async () => {
    try {
      setIsSyncing(true)
      const res = await fetch(`/api/common-specs/sync?service=${activeServiceId}`, { method: 'POST' })
      const json = await res.json()
      if (json.status === 'success') {
        showToast({ type: 'success', message: '公共规范与数据结构同步成功！' })
        fetchSpecs()
      } else {
        showToast({ type: 'error', message: json.detail || '同步失败' })
      }
    } catch (e: any) {
      showToast({ type: 'error', message: `同步异常: ${e.message}` })
    } finally {
      setIsSyncing(false)
    }
  }

  // 过滤后的数据结构列表
  const filteredStructList = useMemo(() => {
    if (!specs?.structs?.structs) return []
    const allNames = Object.keys(specs.structs.structs)
    if (!structSearch.trim()) return allNames
    const q = structSearch.toLowerCase()
    return allNames.filter((name) => name.toLowerCase().includes(q))
  }, [specs, structSearch])

  // 当前选中的结构体定义
  const currentStructFields = useMemo(() => {
    if (!specs?.structs?.structs) return []
    return specs.structs.structs[selectedStructName] || []
  }, [specs, selectedStructName])

  // 过滤后的错误码列表
  const filteredErrors = useMemo(() => {
    if (!specs?.errors?.error_map) return []
    const all = Object.values(specs.errors.error_map) as Array<{
      code: string
      desc: string
      solution: string
      scope: 'global' | 'business'
    }>

    return all.filter((err) => {
      if (errorScopeFilter !== 'all' && err.scope !== errorScopeFilter) {
        return false
      }
      if (!errorSearch.trim()) return true
      const q = errorSearch.toLowerCase()
      return (
        err.code.toLowerCase().includes(q) ||
        (err.desc && err.desc.toLowerCase().includes(q)) ||
        (err.solution && err.solution.toLowerCase().includes(q))
      )
    })
  }, [specs, errorSearch, errorScopeFilter])

  // 过滤后的映射表列表
  const filteredMappings = useMemo(() => {
    if (!specs?.mappings) return []
    const items = specs.mappings[mappingTab] || []
    if (!mappingSearch.trim()) return items
    const q = mappingSearch.toLowerCase()
    return items.filter(
      (it: any) =>
        (it.zh && it.zh.toLowerCase().includes(q)) ||
        (it.en && it.en.toLowerCase().includes(q))
    )
  }, [specs, mappingTab, mappingSearch])

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
        <RefreshCw className="h-6 w-6 animate-spin mb-3 text-blue-500" />
        <span className="text-xs font-medium">正在加载腾讯云 API 3.0 公共标准规范...</span>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* 顶部二级导航：4大核心板块切换 */}
      <div className="shrink-0 px-4 sm:px-6 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-1.5 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('invocation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'invocation'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            <span>调用方式与协议规范</span>
          </button>

          <button
            onClick={() => setActiveTab('structs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'structs'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>数据结构 (138 个)</span>
            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded-full font-mono">
              20474
            </span>
          </button>

          <button
            onClick={() => setActiveTab('errors')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'errors'
                ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>错误码检索库</span>
            <span className="text-[10px] bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 px-1.5 py-0.2 rounded-full font-mono">
              30427
            </span>
          </button>

          <button
            onClick={() => setActiveTab('mappings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'mappings'
                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>附录与映射表</span>
            <span className="text-[10px] bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 px-1.5 py-0.2 rounded-full font-mono">
              34019
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSyncSpecs}
            disabled={isSyncing}
            className="h-8 text-xs gap-1.5 font-medium border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shadow-2xs"
            title="重新抓取并结构化解析腾讯云官方 9 大公共文档"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-blue-500' : 'text-slate-500'}`} />
            <span>{isSyncing ? '正在同步规范...' : '一键同步官方公共文档'}</span>
          </Button>
        </div>
      </div>

      {/* 板块 1: 调用方式与协议规范 */}
      {activeTab === 'invocation' && (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* 左侧子菜单 */}
          <div className="w-full md:w-56 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-3 space-y-1.5 select-none overflow-y-auto">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
              调用规范目录 (API 3.0)
            </div>

            <button
              onClick={() => setInvocationSection('request')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                invocationSection === 'request'
                  ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>1. 请求结构与地域接入</span>
              <span className="font-mono text-[10px] opacity-70">20458</span>
            </button>

            <button
              onClick={() => setInvocationSection('headers')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                invocationSection === 'headers'
                  ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>2. 公共参数 (Headers)</span>
              <span className="font-mono text-[10px] opacity-70">20459</span>
            </button>

            <button
              onClick={() => setInvocationSection('sig3')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                invocationSection === 'sig3'
                  ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>3. TC3 签名计算算法</span>
              <span className="font-mono text-[10px] opacity-70">30661</span>
            </button>

            <button
              onClick={() => setInvocationSection('response')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                invocationSection === 'response'
                  ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>4. 返回结构标准</span>
              <span className="font-mono text-[10px] opacity-70">20461</span>
            </button>

            <button
              onClick={() => setInvocationSection('types')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                invocationSection === 'types'
                  ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>5. 参数类型定义</span>
              <span className="font-mono text-[10px] opacity-70">78521</span>
            </button>
          </div>

          {/* 右侧主内容展示区 */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {invocationSection === 'request' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>请求结构规范</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        Doc ID 20458
                      </Badge>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      腾讯云 API 3.0 推荐采用 HTTPS POST 请求，报文格式为 JSON，默认字符编码 UTF-8。
                    </p>
                  </div>
                  <a
                    href="https://cloud.tencent.com/document/api/267/20458"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <span>官方文档</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-medium">默认协议</span>
                    <div className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200 mt-0.5">HTTPS</div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-medium">推荐方法</span>
                    <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">POST</div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-medium">请求格式</span>
                    <div className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">application/json</div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-medium">就近接入域名</span>
                    <div className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 mt-1 truncate">
                      live.tencentcloudapi.com
                    </div>
                  </div>
                </div>

                {/* 地域接入点列表 (通用地域) */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      通用地域接入域名列表 ({specs?.invocation?.request_structure?.endpoints?.length || 0})
                    </span>
                    <span className="text-[10px] text-slate-400">支持全国就近地域多活与同城容灾接入</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 text-slate-400 text-[10px]">
                          <th className="py-2.5 px-4 font-semibold">接入地域</th>
                          <th className="py-2.5 px-4 font-semibold font-mono">专属域名 Endpoint</th>
                          <th className="py-2.5 px-4 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                        {(specs?.invocation?.request_structure?.endpoints || []).map((ep: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-4 font-sans font-medium text-slate-700 dark:text-slate-300">
                              {ep.region_name}
                            </td>
                            <td className="py-2.5 px-4 text-blue-600 dark:text-blue-400 font-medium">{ep.endpoint}</td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                onClick={() => handleCopy(ep.endpoint, `ep_${idx}`)}
                                className="text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                title="复制接入域名"
                              >
                                {copiedKey === `ep_${idx}` ? <Check className="h-3.5 w-3.5 text-emerald-500 inline" /> : <Copy className="h-3.5 w-3.5 inline" />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 金融专区接入点列表 (若存在) */}
                {specs?.invocation?.request_structure?.financial_endpoints?.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                    <div className="px-4 py-3 bg-amber-50/60 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        金融专区接入域名列表 ({specs.invocation.request_structure.financial_endpoints.length})
                      </span>
                      <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80">满足金融合规隔离场景专属接入</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 text-slate-400 text-[10px]">
                            <th className="py-2.5 px-4 font-semibold">金融专区地域</th>
                            <th className="py-2.5 px-4 font-semibold font-mono">专属域名 Endpoint</th>
                            <th className="py-2.5 px-4 text-right">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                          {specs.invocation.request_structure.financial_endpoints.map((ep: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-4 font-sans font-medium text-slate-700 dark:text-slate-300">
                                {ep.region_name}
                              </td>
                              <td className="py-2.5 px-4 text-amber-600 dark:text-amber-400 font-medium">{ep.endpoint}</td>
                              <td className="py-2.5 px-4 text-right">
                                <button
                                  onClick={() => handleCopy(ep.endpoint, `fep_${idx}`)}
                                  className="text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                  title="复制金融接入域名"
                                >
                                  {copiedKey === `fep_${idx}` ? <Check className="h-3.5 w-3.5 text-emerald-500 inline" /> : <Copy className="h-3.5 w-3.5 inline" />}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {invocationSection === 'headers' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>公共参数 (v3 标准 HTTP Headers)</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        Doc ID 20459
                      </Badge>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      腾讯云 API 3.0 的公共参数统一通过标准 HTTP Headers 传递，不在 Query 或 Body 中冗余放置。
                    </p>
                  </div>
                  <a
                    href="https://cloud.tencent.com/document/api/267/20459"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <span>官方文档</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 text-[10px]">
                        <th className="py-2.5 px-4 font-semibold">参数</th>
                        <th className="py-2.5 px-4 font-semibold font-mono">标准 HTTP Header</th>
                        <th className="py-2.5 px-2 font-semibold">类型</th>
                        <th className="py-2.5 px-2 font-semibold">必选</th>
                        <th className="py-2.5 px-4 font-semibold">说明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(specs?.invocation?.common_params?.v3_headers || []).map((h: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {h.param}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-blue-600 dark:text-blue-400 font-bold">
                            {h.header}
                          </td>
                          <td className="py-2.5 px-2 font-mono text-[11px] text-slate-500">{h.type}</td>
                          <td className="py-2.5 px-2">
                            {h.required ? (
                              <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 text-[9px] py-0 px-1 border-rose-200 dark:border-rose-800">
                                必选
                              </Badge>
                            ) : (
                              <span className="text-slate-400 text-[10px]">可选</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                            {h.desc}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 地域列表对照表 */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200">
                    支持地域列表 (X-TC-Region)
                  </div>
                  <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(specs?.invocation?.common_params?.regions || []).map((r: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex flex-col"
                      >
                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                          {r.region_name}
                        </span>
                        <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                          {r.region_code}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {invocationSection === 'sig3' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>签名方法 v3 规范 (TC3-HMAC-SHA256)</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        Doc ID 30661
                      </Badge>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      系统已完全自动化驱动该签名过程，支持多层派生密钥计算与 Authorization Header 组装。
                    </p>
                  </div>
                  <a
                    href="https://cloud.tencent.com/document/api/267/30661"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <span>官方文档</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="space-y-3">
                  {(specs?.invocation?.signature_v3?.steps || []).map((step: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-200">
                        <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] flex items-center justify-center font-mono">
                          {step.step}
                        </span>
                        <span>{step.name}</span>
                      </div>
                      <div className="font-mono text-[11px] p-2 bg-slate-50 dark:bg-slate-950 rounded-lg text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800">
                        {step.formula}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-900/50">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                    标准 Authorization 请求头格式:
                  </span>
                  <div className="font-mono text-xs text-blue-700 dark:text-blue-300 mt-1 break-all p-2 bg-white dark:bg-slate-900 rounded border border-blue-200 dark:border-blue-800">
                    {specs?.invocation?.signature_v3?.auth_header_format}
                  </div>
                </div>
              </div>
            )}

            {invocationSection === 'response' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>返回结果结构 (Response Envelope)</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        Doc ID 20461
                      </Badge>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      统一由顶级字段 Response 包裹。成功应答包含 RequestId 与业务数据，错误应答包含 Error 对象与 RequestId。
                    </p>
                  </div>
                  <a
                    href="https://cloud.tencent.com/document/api/267/20461"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <span>官方文档</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>正确返回结构示例</span>
                    </span>
                    <JsonCodeEditor
                      value={JSON.stringify(specs?.invocation?.response_structure?.success_envelope, null, 2)}
                      readOnly={true}
                      height="200px"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-400 mb-1.5 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>错误返回结构示例</span>
                    </span>
                    <JsonCodeEditor
                      value={JSON.stringify(specs?.invocation?.response_structure?.error_envelope, null, 2)}
                      readOnly={true}
                      height="200px"
                    />
                  </div>
                </div>
              </div>
            )}

            {invocationSection === 'types' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>API 3.0 支持的参数类型定义</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        Doc ID 78521
                      </Badge>
                    </h3>
                  </div>
                  <a
                    href="https://cloud.tencent.com/document/api/267/78521"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <span>官方文档</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(specs?.invocation?.param_types?.types || []).map((t: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs"
                    >
                      <div className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">{t.type}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{t.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 板块 2: 数据结构 (138 个结构体速查) */}
      {activeTab === 'structs' && (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* 左侧：结构体搜索与列表 */}
          <div className="w-full md:w-80 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-3 flex flex-col min-h-0">
            <div className="relative mb-2">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <Input
                placeholder="搜索结构体 (如 CommonMix...)"
                value={structSearch}
                onChange={(e) => setStructSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-50 dark:bg-slate-850"
              />
            </div>

            <div className="text-[10px] text-slate-400 font-semibold px-1 py-1 flex items-center justify-between">
              <span>结构体列表</span>
              <span>{filteredStructList.length} 个</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
              {filteredStructList.map((name) => {
                const count = specs?.structs?.structs?.[name]?.length || 0
                const isSelected = name === selectedStructName
                return (
                  <button
                    key={name}
                    onClick={() => setSelectedStructName(name)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">{name}</span>
                    <span className="text-[10px] text-slate-400 shrink-0 ml-1">{count} 字段</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 右侧：结构体字段详情表 */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                    {selectedStructName}
                  </h3>
                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-[10px]">
                    {currentStructFields.length} 个字段
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  官方数据结构文档 20474 定义，用于复杂入参对象与数组元素结构的自动推导与表单渲染。
                </p>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(JSON.stringify(currentStructFields, null, 2), 'struct_schema')}
                className="h-8 text-xs gap-1 cursor-pointer"
              >
                {copiedKey === 'struct_schema' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                <span>复制 Schema</span>
              </Button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 text-[10px]">
                    <th className="py-2.5 px-4 font-semibold font-mono">字段名称 (Name)</th>
                    <th className="py-2.5 px-3 font-semibold font-mono">类型 (Type)</th>
                    <th className="py-2.5 px-2 font-semibold">必填</th>
                    <th className="py-2.5 px-4 font-semibold">说明与示例值 (Description)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currentStructFields.map((field: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {field.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-blue-600 dark:text-blue-400">{field.type}</td>
                      <td className="py-2.5 px-2">
                        {field.required ? (
                          <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 text-[9px] py-0 px-1 border-rose-200 dark:border-rose-800">
                            必选
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-[10px]">可选</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                        {field.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 板块 3: 错误码中心 (268 个官方错误码与解决指引) */}
      {activeTab === 'errors' && (
        <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 space-y-4 overflow-hidden">
          {/* 搜索与过滤栏 */}
          <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <Input
                  placeholder="搜索错误码或关键字 (如 StreamNotExist, AuthFailure...)"
                  value={errorSearch}
                  onChange={(e) => setErrorSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-850 text-xs">
              <button
                onClick={() => setErrorScopeFilter('all')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  errorScopeFilter === 'all'
                    ? 'bg-white dark:bg-slate-750 text-slate-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                全部 ({specs?.errors?.total_count || 0})
              </button>
              <button
                onClick={() => setErrorScopeFilter('global')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  errorScopeFilter === 'global'
                    ? 'bg-white dark:bg-slate-750 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                公共错误码 ({specs?.errors?.global_count || 0})
              </button>
              <button
                onClick={() => setErrorScopeFilter('business')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  errorScopeFilter === 'business'
                    ? 'bg-white dark:bg-slate-750 text-rose-600 dark:text-rose-400 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                业务错误码 ({specs?.errors?.business_count || 0})
              </button>
            </div>
          </div>

          {/* 错误码列表卡片 */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredErrors.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">未找到匹配的错误码</div>
            ) : (
              filteredErrors.map((err, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                        {err.code}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 ${
                          err.scope === 'global'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {err.scope === 'global' ? '公共错误码' : '业务错误码'}
                      </Badge>
                    </div>

                    <button
                      onClick={() => handleCopy(err.code, `err_${idx}`)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer text-xs"
                      title="复制错误码"
                    >
                      {copiedKey === `err_${idx}` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <p className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                    {err.desc}
                  </p>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5 bg-slate-50 dark:bg-slate-850 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">排查指引：{err.solution}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 板块 4: 附录与映射表 (34019) */}
      {activeTab === 'mappings' && (
        <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 space-y-4 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-850 text-xs">
              <button
                onClick={() => setMappingTab('countries')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                  mappingTab === 'countries'
                    ? 'bg-white dark:bg-slate-750 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                国家或地区映射表 ({specs?.mappings?.countries_count || 0})
              </button>
              <button
                onClick={() => setMappingTab('provinces')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                  mappingTab === 'provinces'
                    ? 'bg-white dark:bg-slate-750 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                省份映射表 ({specs?.mappings?.provinces_count || 0})
              </button>
              <button
                onClick={() => setMappingTab('isps')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                  mappingTab === 'isps'
                    ? 'bg-white dark:bg-slate-750 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                运营商映射表 ({specs?.mappings?.isps_count || 0})
              </button>
            </div>

            <div className="relative w-64">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <Input
                placeholder="搜索中英文对照..."
                value={mappingSearch}
                onChange={(e) => setMappingSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 text-[10px]">
                  <th className="py-2.5 px-4 font-semibold">中文名称</th>
                  <th className="py-2.5 px-4 font-semibold font-mono">英文名称 (English Name)</th>
                  <th className="py-2.5 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredMappings.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 text-slate-800 dark:text-slate-200">{item.zh}</td>
                    <td className="py-2.5 px-4 font-mono text-blue-600 dark:text-blue-400">{item.en}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => handleCopy(item.en, `map_${idx}`)}
                        className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        title="复制英文标准值"
                      >
                        {copiedKey === `map_${idx}` ? <Check className="h-3 w-3 text-emerald-500 inline" /> : <Copy className="h-3 w-3 inline" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
