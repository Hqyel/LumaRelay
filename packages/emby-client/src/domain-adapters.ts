import {
  ServerSummarySchema,
  UserProfileSchema,
  type ServerCapabilityFlags,
  type ServerSummary,
  type UserProfile,
} from "@newemby/contracts";
import { z } from "zod";

import { normalizeEmbyBaseUrl } from "./url.js";

export const EmbyPublicInfoDtoSchema = z.object({
  Id: z.string().min(1),
  ServerName: z.string().min(1),
  Version: z.string().min(1),
});

export const EmbyUserDtoSchema = z.object({
  Id: z.string().min(1),
  Name: z.string().min(1),
  Policy: z
    .object({
      EnableContentDownloading: z.boolean().optional(),
      IsAdministrator: z.boolean().optional(),
      IsDisabled: z.boolean().optional(),
    })
    .nullish(),
  PrimaryImageTag: z.string().min(1).nullish(),
});

export type EmbyPublicInfoDto = z.infer<typeof EmbyPublicInfoDtoSchema>;
export type EmbyUserDto = z.infer<typeof EmbyUserDtoSchema>;

export interface ServerSummaryContext {
  baseUrl: string;
  capabilityFlags: ServerCapabilityFlags;
  latencyMs: number;
}

export function toServerSummary(
  dto: EmbyPublicInfoDto,
  context: ServerSummaryContext,
): ServerSummary {
  const baseUrl = normalizeEmbyBaseUrl(context.baseUrl);

  return ServerSummarySchema.parse({
    baseUrl,
    capabilityFlags: context.capabilityFlags,
    latencyMs: Math.max(0, Math.round(context.latencyMs)),
    name: dto.ServerName,
    serverId: dto.Id,
    supportsHttps: new URL(baseUrl).protocol === "https:",
    version: dto.Version,
  });
}

export function toUserProfile(dto: EmbyUserDto, serverId: string): UserProfile {
  const isAdministrator = dto.Policy?.IsAdministrator === true;

  return UserProfileSchema.parse({
    name: dto.Name,
    permissions: {
      canDownload: dto.Policy?.EnableContentDownloading === true,
      canManageServer: isAdministrator,
      isAdministrator,
    },
    primaryImageTag: dto.PrimaryImageTag ?? undefined,
    serverId,
    userId: dto.Id,
  });
}
