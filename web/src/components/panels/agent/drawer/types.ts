export interface LearnedGuideline {
  id: string
  instruction: string
  reason?: string
  created_at: string
}

export interface SkillItem {
  name: string
  description: string
  code: string
  input_schema?: Record<string, any>
  created_at: string
}

export interface MemoryItem {
  key: string
  content: string
  created_at: string
  updated_at: string
}

export interface BotFileItem {
  name: string
  original_name: string
  size: number
  size_formatted: string
  category: string
  type: string
  url: string
  created_at: string
  is_referenced: boolean
}

export interface KnowledgeDoc {
  id: string
  name: string
  stored_name: string
  file_type: string
  size: number
  size_formatted: string
  chunks_count: number
  enabled: boolean
  tags: string[]
  created_at: string
  preview?: string
}

export interface LLMConfigData {
  provider: string
  model_name: string
  base_url: string
  api_key_masked?: string
  has_api_key?: boolean
  temperature: number
  max_steps?: number
  context_budget?: number
  max_context_turns?: number
}

export interface BotSummary {
  id: string
  name: string
  avatar: string
  description: string
  base_prompt: string
  learned_guidelines: LearnedGuideline[]
  skills_count: number
  memories_count: number
  guidelines_count: number
  files_count?: number
  suggested_prompts?: string[]
  model_override?: any
  stats?: {
    total_runs: number
    total_tokens: number
    total_code_executions: number
    total_duration_seconds: number
  }
  created_at?: string
  updated_at?: string
  last_message?: {
    role: 'user' | 'assistant'
    content: string
    timestamp?: string
  }
  skills?: SkillItem[]
  memories?: MemoryItem[]
  assembled_prompt?: string
  hierarchical_memory?: HierarchicalMemoryData
}

export interface HierarchicalMemoryData {
  working_memory_turns: number
  working_memory_chars?: number
  context_budget: number
  max_context_turns: number
  compacted_history_count: number
  running_summary: string
  entities_catalog: {
    groups?: string[]
    apis?: string[]
    accounts?: string[]
  }
  runtime_variables: Record<string, string>
  total_history_count: number
  assembled_task_prompt: string
}
