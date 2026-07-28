import { describe, expect, it, vi } from "vitest";

vi.mock("~/prisma/client/enums", () => ({
  AgeRatingOrganization: {},
  MetadataSource: { Steam: "Steam" },
}));

vi.mock("cheerio", () => ({
  load: vi.fn(() => () => ({ text: () => "" })),
}));

vi.mock("jdenticon", () => ({
  toSvg: vi.fn(),
}));

vi.mock("../../../server/internal/utils/ageRatings", () => ({
  ESRBRating: {},
  PEGIRating: {},
  USKRating: {},
  ACBRating: {},
}));

const { SteamProvider } =
  await import("../../../server/internal/metadata/steam");

const callPrivate = <T>(
  provider: InstanceType<typeof SteamProvider>,
  method: string,
  ...args: unknown[]
): T =>
  (provider as unknown as Record<string, (...a: unknown[]) => T>)[method]!(
    ...args,
  );

describe("SteamProvider._convertBasicHtmlElements", () => {
  const provider = new SteamProvider();

  it("strips HTML comments including nested/malformed", () => {
    const input = "before <!-- a --> middle <!-- b --> after";
    const out = callPrivate<string>(
      provider,
      "_convertBasicHtmlElements",
      input,
    );
    expect(out).toBe("before  middle  after");
  });

  it("converts bullet points with tabs to markdown list", () => {
    const input = "•\titem one\n•\titem two";
    const out = callPrivate<string>(
      provider,
      "_convertBasicHtmlElements",
      input,
    );
    expect(out).toContain("\n- item one");
    expect(out).toContain("\n- item two");
  });

  it("converts numbered enumeration with tab to markdown", () => {
    const input = "1.\tfirst\n2.\tsecond";
    const out = callPrivate<string>(
      provider,
      "_convertBasicHtmlElements",
      input,
    );
    expect(out).toContain("\n1. first");
    expect(out).toContain("\n2. second");
  });
});

describe("SteamProvider._cleanupBasicFormatting", () => {
  const provider = new SteamProvider();

  it("strips trailing whitespace before newlines", () => {
    const input = "line one   \nline two\t\nline three";
    const out = callPrivate<string>(provider, "_cleanupBasicFormatting", input);
    expect(out).toBe("line one\nline two\nline three");
  });

  it("removes excessive whitespace before punctuation", () => {
    const input = "hello , world ! foo ; bar ?";
    const out = callPrivate<string>(provider, "_cleanupBasicFormatting", input);
    expect(out).toBe("hello, world! foo; bar?");
  });

  it("preserves single spaces between words", () => {
    const input = "a b c";
    const out = callPrivate<string>(provider, "_cleanupBasicFormatting", input);
    expect(out).toBe("a b c");
  });
});
