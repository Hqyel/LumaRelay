import { queryOptions } from "@tanstack/react-query";

import { fetchLocalBridgeStatus } from "./bridge-client.js";

export const bridgeStatusQuery = queryOptions({
  queryFn: ({ signal }) => fetchLocalBridgeStatus(signal),
  queryKey: ["local-bridge", "status"],
  refetchInterval: 5_000,
  refetchIntervalInBackground: false,
  retry: false,
  staleTime: 2_000,
});
