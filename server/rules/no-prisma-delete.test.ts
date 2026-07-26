import { RuleTester, type Rule } from "eslint";
import { describe, it } from "vitest";
import rule from "./no-prisma-delete.mts";

// The rule is authored against `TSESLint.RuleModule` typings, but its shape
// (meta + create) is compatible with ESLint's own `Rule.RuleModule`, and the
// rule only inspects plain ESTree `CallExpression`/`MemberExpression` nodes,
// so it can be exercised with the default (non-TypeScript) parser.
const ruleUnderTest = rule as unknown as Rule.RuleModule;

describe("no-prisma-delete", () => {
  const ruleTester = new RuleTester({
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  });

  it("enforces .delete restrictions but allows .update everywhere", () => {
    ruleTester.run("no-prisma-delete", ruleUnderTest, {
      valid: [
        // `update` was removed from the blacklist by this PR: soft-delete
        // via `.update(..., { deletedAt })` is now the sanctioned pattern
        // and must not be reported, even on models outside the allow-list.
        "prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });",
        "prisma.game.update({ where: { id }, data: { name: 'foo' } });",

        // `.delete` is still allowed on the documented allow-list of
        // join tables / auth tokens / ephemeral data models.
        "prisma.companyGame.delete({ where: { id } });",
        "prisma.gameTag.delete({ where: { id } });",
        "prisma.linkedAuthMec.delete({ where: { id } });",
        "prisma.linkedMFAMec.delete({ where: { id } });",
        "prisma.invitation.delete({ where: { id } });",
        "prisma.apiToken.delete({ where: { id } });",
        "prisma.certificate.delete({ where: { id } });",
        "prisma.session.delete({ where: { id } });",

        // `.delete` on an object that isn't the `prisma` client is unrelated.
        "someOtherClient.user.delete({ where: { id } });",

        // A bare call to a function literally named `delete` (no member
        // chain deep enough to reach a `prisma.<model>` shape) is ignored.
        "myMap.delete(key);",

        // Unrelated Prisma method calls are always fine.
        "prisma.user.findMany();",
        "prisma.user.updateMany({ where: { id }, data: { deletedAt: new Date() } });",
      ],
      invalid: [
        {
          code: "prisma.user.delete({ where: { id } });",
          errors: [{ messageId: "noPrismaDelete" }],
        },
        {
          code: "prisma.game.delete({ where: { id } });",
          errors: [{ messageId: "noPrismaDelete" }],
        },
        {
          // Model names must match the allow-list exactly; a near-miss
          // name is still flagged.
          code: "prisma.session_.delete({ where: { id } });",
          errors: [{ messageId: "noPrismaDelete" }],
        },
      ],
    });
  });
});
