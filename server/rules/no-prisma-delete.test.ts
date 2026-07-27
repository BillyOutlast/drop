import { RuleTester, type Rule } from "eslint";
import rule from "./no-prisma-delete.ts";

// The rule is authored against `TSESLint.RuleModule` typings, but its shape
// (meta + create) is compatible with ESLint's own `Rule.RuleModule`, and the
// rule only inspects plain ESTree `CallExpression`/`MemberExpression` nodes,
// so it can be exercised with the default (non-TypeScript) parser.
const ruleUnderTest = rule as unknown as Rule.RuleModule;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-prisma-delete", ruleUnderTest, {
  valid: [
    // `.update` is not blocked — soft-delete via `.update(..., { deletedAt })`
    // is the sanctioned pattern.
    "prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });",
    "prisma.game.update({ where: { id }, data: { name: 'foo' } });",

    // `.delete` is allowed on the documented allow-list of join tables /
    // auth tokens / ephemeral data models.
    "prisma.companyGame.delete({ where: { id } });",
    "prisma.gameTag.delete({ where: { id } });",
    "prisma.game.delete({ where: { id } });",
    "prisma.linkedAuthMec.delete({ where: { id } });",
    "prisma.linkedMFAMec.delete({ where: { id } });",
    "prisma.invitation.delete({ where: { id } });",
    "prisma.apiToken.delete({ where: { id } });",
    "prisma.certificate.delete({ where: { id } });",
    "prisma.session.delete({ where: { id } });",

    // `.delete` on a non-prisma client is unrelated.
    "someOtherClient.user.delete({ where: { id } });",

    // Bare `delete` (no prisma member chain) is ignored.
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
      // Model names must match the allow-list exactly; a near-miss
      // name is still flagged.
      code: "prisma.session_.delete({ where: { id } });",
      errors: [{ messageId: "noPrismaDelete" }],
    },
  ],
});
