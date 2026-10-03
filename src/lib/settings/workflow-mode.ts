export const WORKFLOW_MODES = ['HYBRID', 'FREE_WEB', 'DIRECT_API'] as const;

export type WorkflowMode = (typeof WORKFLOW_MODES)[number];

const WORKFLOW_ALIASES: Record<string, WorkflowMode> = {
  HYBRID: 'HYBRID',
  FREE_WEB: 'FREE_WEB',
  DIRECT_API: 'DIRECT_API',
  API_DIRECT: 'DIRECT_API',
};

export function normalizeWorkflowMode(value: unknown): WorkflowMode | null {
  if (typeof value !== 'string') return null;
  return WORKFLOW_ALIASES[value.trim().toUpperCase()] || null;
}

export function resolveWorkflowMode(value: unknown): WorkflowMode {
  return normalizeWorkflowMode(value) || 'HYBRID';
}
