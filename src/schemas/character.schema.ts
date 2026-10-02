import { z } from 'zod';

export const ReferenceTypeEnum = z.enum([
  'PRIMARY_FACE',
  'PRIMARY_FULL_BODY',
  'FRONT',
  'THREE_QUARTER',
  'SIDE',
  'HAPPY',
  'SAD',
  'ANGRY',
  'WORRIED',
]);

export type ReferenceType = z.infer<typeof ReferenceTypeEnum>;

export const CharacterReferenceAssetSchema = z.object({
  id: z.string().optional(),
  referenceType: ReferenceTypeEnum,
  filePath: z.string(),
  thumbnailPath: z.string().optional().nullable(),
  promptUsed: z.string().optional().nullable(),
  isApproved: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type CharacterReferenceAsset = z.infer<typeof CharacterReferenceAssetSchema>;

export const CharacterRoleEnum = z.enum([
  'PROTAGONIST',
  'ANTAGONIST',
  'SUPPORTING',
  'EXTRA',
]);

export type CharacterRole = z.infer<typeof CharacterRoleEnum>;

export const CharacterIdentityPackageSchema = z.object({
  id: z.string().min(1, 'Character ID required'),
  name: z.string().min(1, 'Character name required'),
  role: CharacterRoleEnum.default('PROTAGONIST'),
  gender: z.string().optional().nullable(),

  ageDescription: z.string().min(2, 'Age description required (e.g. "45 years old Indian male")'),
  faceDescription: z.string().min(5, 'Detailed face description required'),
  skinDescription: z.string().min(3, 'Skin tone description required (e.g. "warm dusky wheatish tone")'),
  eyeDescription: z.string().min(3, 'Eye description required (e.g. "deep brown expressive kind eyes")'),
  hairDescription: z.string().min(3, 'Hair description required (e.g. "short wavy dark brown hair touched with silver at temples")'),
  facialHairDescription: z.string().optional().nullable(),

  bodyDescription: z.string().min(3, 'Body build description required (e.g. "lean wiry farmer build")'),
  heightDescription: z.string().optional().nullable(),

  clothingDescription: z.string().min(5, 'Detailed consistent clothing description required'),
  footwearDescription: z.string().optional().nullable(),
  accessories: z.string().optional().nullable(),

  personality: z.string().optional().nullable(),
  defaultExpressions: z.string().optional().nullable(),

  consistencyPrompt: z.string().min(10, 'Consistency prompt required for prompt compilation'),
  negativeConsistencyPrompt: z.string().default('different clothing, changed facial structure, altered hairstyle, wrong skin tone, different age, missing facial features'),

  isLocked: z.boolean().default(false),
  lockedAt: z.string().datetime().optional().nullable(),

  voiceProvider: z.enum(['SARVAM', 'ELEVENLABS']).optional().nullable(),
  voiceId: z.string().optional().nullable(),
  voiceSettings: z.record(z.any()).optional().nullable(),

  referenceAssets: z.array(CharacterReferenceAssetSchema).default([]),
});

export type CharacterIdentityPackage = z.infer<typeof CharacterIdentityPackageSchema>;
