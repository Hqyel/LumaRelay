import { getCurrentUser } from "./api.js";

export const sessionQuery = {
  queryFn: getCurrentUser,
  queryKey: ["auth", "me"],
  retry: false,
  staleTime: 30_000,
} as const;
