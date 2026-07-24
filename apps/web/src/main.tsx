import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { router } from "./router.js";
import { queryClient } from "./runtime.js";
import { initializeTheme } from "./theme.js";
import "./styles.css";

initializeTheme();

const root = document.getElementById("root");

if (root === null) throw new Error("LumaRelay root element was not found");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
