import type { Preview } from "@storybook/react-vite";

import "./storybook.css";

const preview: Preview = {
  parameters: {
    a11y: {
      test: "error",
    },
    backgrounds: {
      default: "LumaRelay",
      values: [{ name: "LumaRelay", value: "#090b0f" }],
    },
    controls: {
      expanded: true,
    },
    layout: "fullscreen",
  },
};

export default preview;
