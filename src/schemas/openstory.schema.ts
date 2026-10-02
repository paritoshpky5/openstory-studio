import { z } from 'zod';
import { StyleBibleSchema, DEFAULT_HINDI_CINEMATIC_STYLE } from './style.schema';
import { CharacterIdentityPackageSchema } from './character.schema';
import { SceneSchema } from './scene.schema';

export const ProjectMetadataSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional().nullable(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '2.39:1']).default('16:9'),
  fps: z.number().int().min(12).max(60).default(24),
  targetLanguage: z.string().default('hi-IN'),
  budgetLimit: z.number().positive().optional().nullable(),
});

export const OpenStoryProjectSchema = z.object({
  schemaVersion: z.literal('1.0.0', {
    errorMap: () => ({ message: 'Unsupported schemaVersion. Expected "1.0.0"' }),
  }),
  project: ProjectMetadataSchema,
  styleBible: StyleBibleSchema.default(DEFAULT_HINDI_CINEMATIC_STYLE),
  characters: z.array(CharacterIdentityPackageSchema).min(1, 'At least one character is required in the story'),
  scenes: z.array(SceneSchema).min(1, 'At least one scene is required'),
});

export const StoryFlowProjectSchema = OpenStoryProjectSchema;

export type OpenStoryProjectInput = z.infer<typeof OpenStoryProjectSchema>;
export type StoryFlowProjectInput = OpenStoryProjectInput;

/**
 * Validates raw story JSON and returns formatted human-readable errors if any.
 */
export function validateOpenStoryJson(rawInput: unknown): {
  success: boolean;
  data?: OpenStoryProjectInput;
  errors?: string[];
} {
  const result = OpenStoryProjectSchema.safeParse(rawInput);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map((err) => {
    const path = err.path.join('.');
    return `${path ? `[${path}]: ` : ''}${err.message}`;
  });

  return { success: false, errors };
}

export const validateStoryFlowJson = validateOpenStoryJson;
