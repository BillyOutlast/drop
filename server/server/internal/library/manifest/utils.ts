import type { JsonValue } from "@prisma/client/runtime/client";

export type V2Manifest = {
  version: "2";
  size: number;
  key: number[];
  chunks: { [key: string]: V2ChunkData };
};

export type V2ChunkData = {
  files: Array<V2FileEntry>;
  checksum: string;
  iv: number[];
};

export type V2FileEntry = {
  filename: string;
  start: number;
  length: number;
  permissions: number;
};

export function castManifest(manifest: JsonValue): V2Manifest {
  if (typeof manifest === "string") {
    return JSON.parse(manifest) as V2Manifest;
  }
  return manifest as V2Manifest;
}
