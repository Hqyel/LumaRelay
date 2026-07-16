import { z } from "zod";

import { RequestIdSchema } from "./common.js";

export const PublicUserSchema = z.object({
  avatarUrl: z.string().min(1).optional(),
  hasPassword: z.boolean(),
  name: z.string().min(1),
  primaryImageTag: z.string().min(1).optional(),
  userId: z.string().min(1),
});

export const PublicUsersResponseSchema = z.object({
  requestId: RequestIdSchema,
  users: z.array(PublicUserSchema),
});

export const PublicUserAvatarParamsSchema = z.object({
  userId: z.string().min(1).max(128),
});

export type PublicUser = z.infer<typeof PublicUserSchema>;
export type PublicUsersResponse = z.infer<typeof PublicUsersResponseSchema>;
