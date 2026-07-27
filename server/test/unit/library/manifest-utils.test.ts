import { describe, expect, it } from "vitest";
import { castManifest, type V2Manifest } from "../../../server/internal/library/manifest/utils";

describe("castManifest", () => {
  const mockManifest: V2Manifest = {
    version: "2",
    size: 1024,
    key: [1, 2, 3],
    chunks: {
      chunk1: {
        files: [{ filename: "test.txt", start: 0, length: 100, permissions: 420 }],
        checksum: "abc123",
        iv: [4, 5, 6],
      },
    },
  };

  it("parses a JSON string into V2Manifest", () => {
    const json = JSON.stringify(mockManifest);
    const result = castManifest(json);
    expect(result.version).toBe("2");
    expect(result.size).toBe(1024);
    expect(result.chunks.chunk1.files[0].filename).toBe("test.txt");
  });

  it("returns the object directly when already an object", () => {
    const result = castManifest(mockManifest);
    expect(result).toBe(mockManifest);
    expect(result.version).toBe("2");
  });

  it("handles an empty string manifest", () => {
    expect(() => castManifest("")).toThrow();
  });

  it("handles invalid JSON string", () => {
    expect(() => castManifest("not-json")).toThrow();
  });
});
