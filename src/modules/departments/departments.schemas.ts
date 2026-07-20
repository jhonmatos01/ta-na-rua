import { z } from 'zod';

const nullableDescription = z.string().trim().max(2000).nullable();

export const departmentIdParamsSchema = z.strictObject({ departmentId: z.uuid() });

export const listDepartmentsQuerySchema = z.strictObject({
  municipalityId: z.uuid().optional(),
  active: z
    .preprocess((value) => {
      if (value === 'true' || value === true) return true;
      if (value === 'false' || value === false) return false;
      return value;
    }, z.boolean())
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createDepartmentSchema = z.strictObject({
  municipalityId: z.uuid(),
  name: z.string().trim().min(2).max(150),
  description: nullableDescription.optional().default(null),
});

export const updateDepartmentSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(150).optional(),
    description: nullableDescription.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Informe ao menos um campo para atualizar.',
  });

export const updateDepartmentActiveSchema = z.strictObject({ active: z.boolean() });

export type ListDepartmentsQuery = z.infer<typeof listDepartmentsQuerySchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
