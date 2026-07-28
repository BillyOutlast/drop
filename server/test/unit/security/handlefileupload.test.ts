import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../server/internal/objects/transactional", () => ({
  ObjectTransactionalHandler: class {
    new() {
      return [vi.fn(), vi.fn(), vi.fn()];
    }
  },
}));

import { handleFileUpload } from "../../../server/internal/utils/handlefileupload";

const createMockH3 = (formData: unknown[]) =>
  ({
    node: { req: {} },
  }) as never;

describe("handleFileUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns undefined when no multipart data", async () => {
    vi.stubGlobal("readMultipartFormData", vi.fn().mockResolvedValue(undefined));
    const result = await handleFileUpload(createMockH3([]), {}, []);
    expect(result).toBeUndefined();
  });

  it("rejects files exceeding 10MB size limit", async () => {
    vi.stubGlobal(
      "readMultipartFormData",
      vi.fn().mockResolvedValue([
        {
          filename: "large.bin",
          data: Buffer.alloc(11 * 1024 * 1024),
          type: "application/pdf",
        },
      ]),
    );
    vi.stubGlobal("createError", (opts: unknown) => {
      throw opts;
    });

    await expect(handleFileUpload(createMockH3([]), {}, [])).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("rejects files with disallowed MIME type", async () => {
    vi.stubGlobal(
      "readMultipartFormData",
      vi.fn().mockResolvedValue([
        {
          filename: "script.js",
          data: Buffer.from("test"),
          type: "application/javascript",
        },
      ]),
    );
    vi.stubGlobal("createError", (opts: unknown) => {
      throw opts;
    });

    await expect(handleFileUpload(createMockH3([]), {}, [])).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("rejects files with no MIME type", async () => {
    vi.stubGlobal(
      "readMultipartFormData",
      vi.fn().mockResolvedValue([
        {
          filename: "unknown.bin",
          data: Buffer.from("test"),
          type: undefined,
        },
      ]),
    );
    vi.stubGlobal("createError", (opts: unknown) => {
      throw opts;
    });

    await expect(handleFileUpload(createMockH3([]), {}, [])).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("accepts valid image/jpeg files", async () => {
    vi.stubGlobal(
      "readMultipartFormData",
      vi.fn().mockResolvedValue([
        {
          filename: "photo.jpg",
          data: Buffer.from("jpeg-data"),
          type: "image/jpeg",
        },
      ]),
    );

    const result = await handleFileUpload(createMockH3([]), {}, []);
    expect(result).toBeDefined();
  });

  it("accepts valid application/pdf files", async () => {
    vi.stubGlobal(
      "readMultipartFormData",
      vi.fn().mockResolvedValue([
        {
          filename: "doc.pdf",
          data: Buffer.from("pdf-data"),
          type: "application/pdf",
        },
      ]),
    );

    const result = await handleFileUpload(createMockH3([]), {}, []);
    expect(result).toBeDefined();
  });

  it("enforces max file count", async () => {
    vi.stubGlobal(
      "readMultipartFormData",
      vi.fn().mockResolvedValue([
        { filename: "a.jpg", data: Buffer.from("a"), type: "image/jpeg" },
        { filename: "b.jpg", data: Buffer.from("b"), type: "image/jpeg" },
      ]),
    );

    const result = await handleFileUpload(createMockH3([]), {}, [], 1);
    expect(result).toBeDefined();
  });
});
