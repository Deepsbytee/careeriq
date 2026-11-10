export interface Evidence {
  point: string
  evidence: string | null
  verified: boolean | null
}

export interface Category {
  score: number
  deterministic: number
  ai: number | null
  ai_reason: string | null
  weight: number
}

export interface Analysis {
  id: string
  resume_id: string
  ats_score: number
  skills: string[] | null
  education: { degree?: string; institution?: string; year?: string }[] | null
  experience: { title?: string; company?: string; duration?: string; highlights?: string[] }[] | null
  keywords: string[] | null
  strengths: string[] | null
  weaknesses: string[] | null
  recommendations: string[] | null
  score_breakdown: { categories: Record<string, Category>; findings: string[]; career_level?: string } | null
  evidence: { strengths: Evidence[]; weaknesses: Evidence[] } | null
  summary: string | null
  created_at: string
}

export interface ResumeSummary {
  id: string
  filename: string
  word_count: number | null
  page_count: number | null
  file_type: string | null
  created_at: string
}

export interface Rewrite {
  original: string
  rewritten: string
  why: string
}

export interface RewriteResult {
  rewrites: Rewrite[]
  considered: number
  skipped: number
}

export interface ResumeDetail extends ResumeSummary {
  raw_text: string | null
  rewrites: RewriteResult | null
}

export interface Scan {
  name: string | null
  latest_role: string | null
  education: string | null
  top_skills: string[]
  signals: { email: boolean; phone: boolean; linkedin: boolean; github: boolean }
  notes: { kind: 'good' | 'warn'; text: string }[]
}

export interface Requirement {
  requirement: string
  importance: 'must' | 'nice'
  status: 'met' | 'partial' | 'missing' | 'unverified'
  evidence: string | null
  note: string
  verified: boolean
}

export interface Candidate {
  rank: number
  filename: string
  name: string
  fit_score: number
  skill_coverage: number
  resume_quality: number
  matched_skills: string[]
  missing_skills: string[]
  extra_skills: string[]
  flags: string[]
}

export interface ScreeningResult {
  job_title: string
  required_skills: string[]
  candidates: Candidate[]
  rejected: { filename: string; reason: string; code: string }[]
  method: string
}
