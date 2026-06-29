import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);
const optionalNonEmptyString = z.string().trim().min(1).optional();
const urlString = z.string().url();

export const baseInputShape = {
  communityUrl: urlString,
  profileDir: optionalNonEmptyString,
  artifactDir: optionalNonEmptyString,
  headless: z.boolean().optional().default(true),
  autoLogin: z.boolean().optional(),
};

export const mutatingInputShape = {
  ...baseInputShape,
  execute: z.boolean().optional().default(false),
};

export const loginInputSchema = z.object(baseInputShape);

export const listClassroomInputSchema = z.object(baseInputShape);

export const mapCommunityInputShape = {
  ...baseInputShape,
  deep: z.boolean().optional().default(false),
};

export const mapCommunityInputSchema = z.object(mapCommunityInputShape);

export const createModuleInputShape = {
  ...mutatingInputShape,
  title: nonEmptyString,
  coverImageFile: optionalNonEmptyString,
};

export const createModuleInputSchema = z.object(createModuleInputShape);

export const createLessonInputShape = {
  ...mutatingInputShape,
  moduleTitle: nonEmptyString,
  title: nonEmptyString,
  body: optionalNonEmptyString,
  videoUrl: urlString.optional(),
  videoFile: optionalNonEmptyString,
  imageFile: optionalNonEmptyString,
};

export const createLessonInputSchema = z.object(createLessonInputShape).refine((input) => !(input.videoUrl && input.videoFile), {
  message: 'Use either videoUrl or videoFile, not both.',
  path: ['videoFile'],
});

export const updateLessonInputShape = {
  ...mutatingInputShape,
  moduleTitle: optionalNonEmptyString,
  lessonTitle: optionalNonEmptyString,
  lessonUrl: urlString.optional(),
  title: optionalNonEmptyString,
  body: optionalNonEmptyString,
  videoUrl: urlString.optional(),
  videoFile: optionalNonEmptyString,
  imageFile: optionalNonEmptyString,
};

export const updateLessonInputSchema = z
  .object(updateLessonInputShape)
  .refine((input) => input.lessonTitle !== undefined || input.lessonUrl !== undefined, {
    message: 'Provide either lessonTitle or lessonUrl to locate the lesson.',
    path: ['lessonTitle'],
  })
  .refine(
    (input) =>
      input.title !== undefined ||
      input.body !== undefined ||
      input.videoUrl !== undefined ||
      input.videoFile !== undefined ||
      input.imageFile !== undefined,
    {
    message: 'At least one editable field is required.',
    path: ['title'],
    },
  )
  .refine((input) => !(input.videoUrl && input.videoFile), {
    message: 'Use either videoUrl or videoFile, not both.',
    path: ['videoFile'],
  });

export const reorderLessonsInputShape = {
  ...mutatingInputShape,
  moduleTitle: nonEmptyString,
  orderedLessonTitles: z.array(nonEmptyString).min(2),
};

export const reorderLessonsInputSchema = z.object(reorderLessonsInputShape);

const batchModuleCreateOperationSchema = z.object({
  type: z.literal('module.create'),
  title: nonEmptyString,
  coverImageFile: optionalNonEmptyString,
});

const batchLessonCreateOperationSchema = z
  .object({
    type: z.literal('lesson.create'),
    moduleTitle: nonEmptyString,
    title: nonEmptyString,
    body: optionalNonEmptyString,
    bodyFile: optionalNonEmptyString,
    videoUrl: urlString.optional(),
    videoFile: optionalNonEmptyString,
    imageFile: optionalNonEmptyString,
  })
  .refine((input) => !(input.body && input.bodyFile), {
    message: 'Use either body or bodyFile, not both.',
    path: ['bodyFile'],
  })
  .refine((input) => !(input.videoUrl && input.videoFile), {
    message: 'Use either videoUrl or videoFile, not both.',
    path: ['videoFile'],
  });

const batchLessonEditOperationSchema = z
  .object({
    type: z.literal('lesson.edit'),
    lessonTitle: nonEmptyString,
    title: optionalNonEmptyString,
    body: optionalNonEmptyString,
    bodyFile: optionalNonEmptyString,
    videoUrl: urlString.optional(),
    videoFile: optionalNonEmptyString,
    imageFile: optionalNonEmptyString,
  })
  .refine((input) => !(input.body && input.bodyFile), {
    message: 'Use either body or bodyFile, not both.',
    path: ['bodyFile'],
  })
  .refine((input) => !(input.videoUrl && input.videoFile), {
    message: 'Use either videoUrl or videoFile, not both.',
    path: ['videoFile'],
  })
  .refine(
    (input) =>
      input.title !== undefined ||
      input.body !== undefined ||
      input.bodyFile !== undefined ||
      input.videoUrl !== undefined ||
      input.videoFile !== undefined ||
      input.imageFile !== undefined,
    {
      message: 'At least one editable field is required.',
      path: ['title'],
    },
  );

export const batchOperationSchema = z.union([
  batchModuleCreateOperationSchema,
  batchLessonCreateOperationSchema,
  batchLessonEditOperationSchema,
]);

export const batchApplyInputShape = {
  ...mutatingInputShape,
  operations: z.array(batchOperationSchema).min(1),
};

export const batchApplyInputSchema = z.object(batchApplyInputShape);

export type LoginInput = z.input<typeof loginInputSchema>;
export type ListClassroomInput = z.input<typeof listClassroomInputSchema>;
export type MapCommunityInput = z.input<typeof mapCommunityInputSchema>;
export type CreateModuleInput = z.input<typeof createModuleInputSchema>;
export type CreateLessonInput = z.input<typeof createLessonInputSchema>;
export type UpdateLessonInput = z.input<typeof updateLessonInputSchema>;
export type ReorderLessonsInput = z.input<typeof reorderLessonsInputSchema>;
export type BatchOperationInput = z.input<typeof batchOperationSchema>;
export type BatchApplyInput = z.input<typeof batchApplyInputSchema>;
