import { describe, expect, it } from 'vitest';
import { normalizeWorkflowMode, resolveWorkflowMode } from '../workflow-mode';

describe('workflow mode normalization', () => {
  it('uses the canonical direct API value', () => {
    expect(normalizeWorkflowMode('DIRECT_API')).toBe('DIRECT_API');
  });

  it('accepts the legacy UI value without breaking saved settings', () => {
    expect(normalizeWorkflowMode('API_DIRECT')).toBe('DIRECT_API');
  });

  it('normalizes case and whitespace', () => {
    expect(normalizeWorkflowMode('  free_web ')).toBe('FREE_WEB');
  });

  it('rejects unsupported values and resolves missing values to hybrid', () => {
    expect(normalizeWorkflowMode('MANUAL')).toBeNull();
    expect(normalizeWorkflowMode(undefined)).toBeNull();
    expect(resolveWorkflowMode(undefined)).toBe('HYBRID');
  });
});
