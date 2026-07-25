import type { JsonValue } from "@prisma/client/runtime/client";
import cacheHandler from "../../cache";
import prisma from "../../db/database";
import { castManifest, type DropletManifest } from "./utils";

export type DownloadManifestDetails = {
  /***
   * Version ID to manifest
   */
  manifests: { [key: string]: DropletManifest };
  /***
   * File name to version ID
   */
  fileList: { [key: string]: string };
  /// Size on disk after download
  installSize: number;
  /// Size of download
  downloadSize: number;
};

function convertMap<T>(map: Map<string, T>): { [key: string]: T } {
  return Object.fromEntries(map.entries().toArray());
}

function buildFileList(
  versionOrder: Array<{
    versionId: string;
    fileList: string[];
    negativeFileList: string[];
  }>,
): Map<string, string> {
  const fileList = new Map<string, string>();
  for (const version of versionOrder) {
    for (const file of version.fileList) {
      fileList.set(file, version.versionId);
    }
    for (const negFile of version.negativeFileList) {
      fileList.delete(negFile);
    }
  }
  return fileList;
}

function buildVersionManifests(
  versionOrder: Array<{
    versionId: string;
    dropletManifest: JsonValue;
  }>,
  fileList: Map<string, string>,
  existingChunks: DownloadManifestDetails | undefined,
) {
  const manifests = new Map<string, DropletManifest>();
  let installSize = 0;
  let downloadSize = 0;

  for (const version of versionOrder) {
    const files = fileList
      .entries()
      .filter(([, versionId]) => version.versionId === versionId)
      .toArray();
    if (files.length == 0) continue;
    const fileNames = Object.fromEntries(files);
    const manifest = castManifest(version.dropletManifest);
    const filteredChunks = Object.fromEntries(
      Object.entries(manifest.chunks).filter(([_, chunkData]) => {
        let flag = false;
        chunkData.files.forEach((fileEntry) => {
          if (
            existingChunks?.fileList[fileEntry.filename] == version.versionId
          )
            return;
          if (fileNames[fileEntry.filename]) {
            flag = true;
            installSize += fileEntry.length;
          }
        });
        if (flag) {
          downloadSize += chunkData.files
            .map((v) => v.length)
            .reduce((a, b) => a + b, 0);
        }
        return flag;
      }),
    );
    manifests.set(version.versionId, {
      ...manifest,
      chunks: filteredChunks,
    });
  }

  return { manifests, installSize, downloadSize };
}
const manifestCache =
  cacheHandler.createCache<DownloadManifestDetails>("manifestCache");

/**
 *
 * @param gameId Game ID
 * @param versionId Version ID
 */
export async function createDownloadManifestDetails(
  versionId: string,
  previous?: string,
  refresh = false,
): Promise<DownloadManifestDetails> {
  const suffix = previous ? "-from-" + previous : "";
  const manifestKey = versionId + suffix;
  if ((await manifestCache.has(manifestKey)) && !refresh)
    return (await manifestCache.get(manifestKey))!;
  const mainVersion = await prisma.gameVersion.findUnique({
    where: { versionId },
    select: {
      versionId: true,
      delta: true,
      versionIndex: true,
      fileList: true,
      negativeFileList: true,
      gameId: true,
      dropletManifest: true,
    },
  });
  if (!mainVersion)
    throw createError({ statusCode: 404, message: "Version not found" });

  const collectedVersions = [];
  let versionIndex = mainVersion.versionIndex;
  while (mainVersion.delta) {
    const nextVersion = await prisma.gameVersion.findFirst({
      where: { gameId: mainVersion.gameId, versionIndex: { lt: versionIndex } },
      orderBy: {
        versionIndex: "desc",
      },
      select: {
        versionId: true,
        versionIndex: true,
        delta: true,
        fileList: true,
        negativeFileList: true,
        dropletManifest: true,
      },
    });
    if (!nextVersion)
      throw createError({
        statusCode: 500,
        message: "Delta version without version underneath it.",
      });

    versionIndex = nextVersion.versionIndex;
    collectedVersions.push(nextVersion);
    if (!nextVersion.delta) break;
  }

  collectedVersions.reverse();
  // Apply fileList in lowest priority to newest priority
  const versionOrder = [...collectedVersions, mainVersion];

  const fileList = buildFileList(versionOrder);

  let installSize = 0;
  let downloadSize = 0;

  const existingChunks = previous
    ? await createDownloadManifestDetails(previous)
    : undefined;

  const built = buildVersionManifests(versionOrder, fileList, existingChunks);
  installSize = built.installSize;
  downloadSize = built.downloadSize;

  const result: DownloadManifestDetails = {
    fileList: convertMap(fileList),
    manifests: convertMap(built.manifests),
    installSize,
    downloadSize,
  };
  await manifestCache.set(manifestKey, result);

  return result;
}
