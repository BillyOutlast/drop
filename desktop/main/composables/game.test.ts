/**
 * Unit tests for the `game` composable.
 *
 * `useGame`/`parseStatus` rely on Nuxt's auto-imported `ref` (never imported
 * explicitly in the source file) and on the Tauri `invoke`/`listen` APIs.
 * Outside of a Nuxt runtime we have to stub `ref` as a global and mock the
 * Tauri modules ourselves.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { parseStatus, useGame } from "./game";
import {
  InstalledType,
  type Game,
  type GameStatus,
  type GameVersion,
  type RawGameStatus,
} from "../types";

const mockInvoke = vi.fn();
const mockListen = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

// `ref` is normally supplied by Nuxt's auto-import compiler magic. Stub it on
// the global object so the composable (which references it as a bare
// identifier) resolves correctly when imported directly in a test.
vi.stubGlobal("ref", ref);

function makeGame(id: string): Game {
  return {
    id,
    type: "Game",
    mName: `Game ${id}`,
    mShortDescription: "short",
    mDescription: "description",
    mIconObjectId: "icon",
    mBannerObjectId: "banner",
    mCoverObjectId: "cover",
    mImageLibraryObjectIds: [],
    mImageCarouselObjectIds: [],
  };
}

function makeInstalledStatus(versionId: string): GameStatus {
  return {
    type: "Installed",
    install_type: { type: InstalledType.Installed },
    version_id: versionId,
    install_dir: "/tmp/game",
    update_available: false,
  };
}

function makeVersion(): GameVersion {
  return {
    userConfiguration: {
      launchTemplate: "",
      overrideProtonPath: "",
      overrideHandler: undefined,
      enableUpdates: true,
    },
    setups: [],
    launches: [],
  };
}

describe("parseStatus", () => {
  it("returns the primary status when present", () => {
    const status: RawGameStatus = [{ type: "Downloading" }, null];
    expect(parseStatus(status)).toEqual({ type: "Downloading" });
  });

  it("falls back to the secondary status when the primary is null", () => {
    const status: RawGameStatus = [null, { type: "Queued" }];
    expect(parseStatus(status)).toEqual({ type: "Queued" });
  });

  it("prefers the primary status when both entries are present", () => {
    const status: RawGameStatus = [{ type: "Running" }, { type: "Queued" }];
    expect(parseStatus(status)).toEqual({ type: "Running" });
  });

  it("throws when both entries are null", () => {
    const status: RawGameStatus = [null, null];
    expect(() => parseStatus(status)).toThrow("No game status");
  });

  it("includes the JSON-stringified status in the thrown error message", () => {
    const status: RawGameStatus = [null, null];
    expect(() => parseStatus(status)).toThrow(JSON.stringify(status));
  });
});

describe("useGame", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockListen.mockReset();
    mockListen.mockResolvedValue(() => {});
  });

  it("fetches game data via invoke with the requested gameId", async () => {
    const gameId = "game-fetch-1";
    const game = makeGame(gameId);
    mockInvoke.mockResolvedValueOnce({
      game,
      status: [{ type: "Downloading" }, null] as RawGameStatus,
    });

    const result = await useGame(gameId);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith("fetch_game", { gameId });
    expect(result.game).toEqual(game);
    expect(result.status.value).toEqual({ type: "Downloading" });
    expect(result.version.value).toBeUndefined();
  });

  it("populates the version ref when the fetch response includes one", async () => {
    const gameId = "game-fetch-with-version";
    const version = makeVersion();
    mockInvoke.mockResolvedValueOnce({
      game: makeGame(gameId),
      status: [makeInstalledStatus("v1"), null] as RawGameStatus,
      version,
    });

    const result = await useGame(gameId);

    expect(result.version.value).toEqual(version);
  });

  it("caches the game registry entry and does not re-invoke for a known gameId", async () => {
    const gameId = "game-cache-1";
    mockInvoke.mockResolvedValueOnce({
      game: makeGame(gameId),
      status: [{ type: "Queued" }, null] as RawGameStatus,
    });

    await useGame(gameId);
    mockInvoke.mockClear();

    const second = await useGame(gameId);

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(second.status.value).toEqual({ type: "Queued" });
  });

  it("registers exactly one listener per gameId, even across repeated calls", async () => {
    const gameId = "game-listen-once";
    mockInvoke.mockResolvedValue({
      game: makeGame(gameId),
      status: [{ type: "Queued" }, null] as RawGameStatus,
    });

    await useGame(gameId);
    await useGame(gameId);

    expect(mockListen).toHaveBeenCalledTimes(1);
    expect(mockListen).toHaveBeenCalledWith(`update_game/${gameId}`, expect.any(Function));
  });

  it("uses a distinct event channel per gameId", async () => {
    const gameIdA = "game-channel-a";
    const gameIdB = "game-channel-b";
    mockInvoke.mockResolvedValue({
      game: makeGame(gameIdA),
      status: [{ type: "Queued" }, null] as RawGameStatus,
    });

    await useGame(gameIdA);
    await useGame(gameIdB);

    expect(mockListen).toHaveBeenNthCalledWith(1, `update_game/${gameIdA}`, expect.any(Function));
    expect(mockListen).toHaveBeenNthCalledWith(2, `update_game/${gameIdB}`, expect.any(Function));
  });

  it("updates the status ref when the Tauri event handler fires", async () => {
    const gameId = "game-update-status";
    let capturedHandler: ((event: { payload: unknown }) => void) | undefined;
    mockListen.mockImplementationOnce(
      (_channel: string, handler: (event: { payload: unknown }) => void) => {
        capturedHandler = handler;
        return Promise.resolve(() => {});
      },
    );
    mockInvoke.mockResolvedValueOnce({
      game: makeGame(gameId),
      status: [{ type: "Queued" }, null] as RawGameStatus,
    });

    const { status } = await useGame(gameId);
    expect(status.value).toEqual({ type: "Queued" });

    capturedHandler!({
      payload: { status: [{ type: "Downloading" }, null] as RawGameStatus },
    });

    expect(status.value).toEqual({ type: "Downloading" });
  });

  it("updates the version ref when the event payload includes a version", async () => {
    const gameId = "game-update-version";
    let capturedHandler: ((event: { payload: unknown }) => void) | undefined;
    mockListen.mockImplementationOnce(
      (_channel: string, handler: (event: { payload: unknown }) => void) => {
        capturedHandler = handler;
        return Promise.resolve(() => {});
      },
    );
    mockInvoke.mockResolvedValueOnce({
      game: makeGame(gameId),
      status: [{ type: "Queued" }, null] as RawGameStatus,
    });

    const { version } = await useGame(gameId);
    expect(version.value).toBeUndefined();

    const newVersion = makeVersion();
    capturedHandler!({
      payload: { status: [makeInstalledStatus("v2"), null], version: newVersion },
    });

    expect(version.value).toEqual(newVersion);
  });

  it("retains the previous version when the event payload omits one (documented behavior)", async () => {
    const gameId = "game-retain-version";
    const initialVersion = makeVersion();
    let capturedHandler: ((event: { payload: unknown }) => void) | undefined;
    mockListen.mockImplementationOnce(
      (_channel: string, handler: (event: { payload: unknown }) => void) => {
        capturedHandler = handler;
        return Promise.resolve(() => {});
      },
    );
    mockInvoke.mockResolvedValueOnce({
      game: makeGame(gameId),
      status: [makeInstalledStatus("v1"), null] as RawGameStatus,
      version: initialVersion,
    });

    const { version } = await useGame(gameId);
    expect(version.value).toEqual(initialVersion);

    // No `version` field on this payload (e.g. game was uninstalled) — the
    // composable intentionally keeps the last known version rather than
    // clearing it.
    capturedHandler!({
      payload: { status: [{ type: "Uninstalling" }, null] as RawGameStatus },
    });

    expect(version.value).toEqual(initialVersion);
  });
});
