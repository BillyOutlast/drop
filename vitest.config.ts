import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "./server",
      {
        test: {
          name: "root",
          root: ".",
          environment: "node",
          include: ["scripts/**/*.test.cjs", ".github/**/*.test.cjs"],
        },
      },
    ],
  },
});
