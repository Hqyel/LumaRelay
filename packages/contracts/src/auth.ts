import { z } from "zod";

import { RequestIdSchema } from "./common.js";
import { ServerSummarySchema } from "./server.js";

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

export const UserPermissionsSchema = z.object({
  canDownload: z.boolean(),
  canManageServer: z.boolean(),
  isAdministrator: z.boolean(),
});

export const UserProfileSchema = z.object({
  name: z.string().min(1),
  permissions: UserPermissionsSchema,
  primaryImageTag: z.string().min(1).optional(),
  serverId: z.string().min(1),
  userId: z.string().min(1),
});

export const LoginRequestSchema = z.object({
  password: z.string().max(1024),
  username: z.string().trim().min(1).max(128),
});

export const LoginResponseSchema = z.object({
  requestId: RequestIdSchema,
  server: ServerSummarySchema,
  user: UserProfileSchema,
});

export type PublicUser = z.infer<typeof PublicUserSchema>;
export type PublicUsersResponse = z.infer<typeof PublicUsersResponseSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type UserPermissions = z.infer<typeof UserPermissionsSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
