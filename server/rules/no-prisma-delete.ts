import type { TSESLint } from "@typescript-eslint/utils";

const blacklistedFunctions = ["delete"];

// Models where hard-delete is correct (join tables, auth tokens, ephemeral data)
const allowedModels = new Set([
  "companyGame",
  "gameTag",
  "linkedAuthMec",
  "linkedMFAMec",
  "invitation",
  "apiToken",
  "certificate",
  "session",
]);

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Don't use Prisma .delete — soft-delete is enforced via .update with deletedAt",
    },
    messages: {
      noPrismaDelete:
        "Prisma .delete(...) is used. Soft-delete via .update(..., { deletedAt: new Date() }) instead.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression: function (node) {
        // @ts-expect-error It ain't typing properly
        const funcId = node.callee.property;
        if (!funcId || !blacklistedFunctions.includes(funcId.name)) return;
        // @ts-expect-error It ain't typing properly
        const tableExpr = node.callee.object;
        if (!tableExpr) return;
        const prismaExpr = tableExpr.object;
        if (prismaExpr?.name !== "prisma") return;
        // Allow hard-delete on join tables, auth tokens, and ephemeral data
        const modelName = tableExpr.property?.name;
        if (modelName && allowedModels.has(modelName)) return;
        context.report({
          node,
          messageId: "noPrismaDelete",
        });
      },
    };
  },
  defaultOptions: [],
} satisfies TSESLint.RuleModule<"noPrismaDelete">;
