// fallow-ignore-file unused-file
import notificationSystem from "~/server/internal/notifications";
import aclManager from "~/server/internal/acls";
import { logger } from "~/server/internal/logging";

// PENDING(sonar): add web socket session management for horizontal scaling - deferred, needs distributed session store
// Peer ID to user ID
const socketSessions = new Map<string, string>();

// Grace period for unauthenticated WebSocket peers to re-authenticate via token message
const AUTH_GRACE_PERIOD_MS = Number.parseInt(
  process.env.WS_AUTH_GRACE_PERIOD ?? "10000",
);
// Track pending auth timeouts keyed by peer ID so they can be cleared on re-auth
const authTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
// Track peers currently being authenticated to prevent race between open and message handlers
const pendingAuth = new Set<string>();
// Buffer for messages arriving while peer is in pendingAuth
const pendingAuthMessageBuffer = new Map<
  string,
  Array<{
    peer: { id: string; send: (data: string) => void; close: () => void };
    msg: { toString(): string };
  }>
>();

// fallow-ignore-next-line complexity
async function authenticatePeer(
  peer: { id: string; send: (data: string) => void },
  headers: Headers,
): Promise<boolean> {
  const h3 = { headers };
  const userId = await aclManager.getUserIdACL(h3, ["notifications:listen"]);
  if (!userId) return false;

  const acls = await aclManager.fetchAllACLs(h3);
  if (!acls) return false;

  // Clean up existing session for this peer before re-registering
  const existingUserId = socketSessions.get(peer.id);
  if (existingUserId) {
    notificationSystem.unlisten(existingUserId, peer.id);
    notificationSystem.unlisten("system", peer.id);
  }

  socketSessions.set(peer.id, userId);
  try {
    notificationSystem.listen(userId, acls, peer.id, (notification) => {
      peer.send(JSON.stringify(notification));
    });
  } catch (_e) {
    socketSessions.delete(peer.id);
    throw _e;
  }
  return true;
}

function clearAuthTimeoutAndClose(peer: {
  id: string;
  close: () => void;
}): void {
  const tid = authTimeouts.get(peer.id);
  if (tid) {
    clearTimeout(tid);
    authTimeouts.delete(peer.id);
  }
  peer.close();
}

function rejectPeer(peer: {
  id: string;
  send: (data: string) => void;
  close: () => void;
}): void {
  peer.send("unauthenticated");
  clearAuthTimeoutAndClose(peer);
}

// fallow-ignore-next-line complexity
async function processMessage(
  peer: { id: string; send: (data: string) => void; close: () => void },
  msg: { toString(): string },
): Promise<void> {
  try {
    // Fast-path: skip JSON.parse for already authenticated peers
    if (socketSessions.has(peer.id)) return;

    const raw = msg.toString();
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      logger.warn({ peerId: peer.id }, "WebSocket: invalid JSON message");
      rejectPeer(peer);
      return;
    }

    if (typeof data !== "object" || data === null) {
      logger.warn(
        { peerId: peer.id },
        "WebSocket: non-object message from peer",
      );
      rejectPeer(peer);
      return;
    }

    const msgData = data as Record<string, unknown>;
    if (msgData.token) {
      if (typeof msgData.token !== "string" || msgData.token.length === 0) {
        logger.warn(
          { peerId: peer.id },
          "WebSocket token auth: invalid token type",
        );
        rejectPeer(peer);
        return;
      }
      // Skip re-authentication if peer is already authenticated
      if (socketSessions.has(peer.id)) return;
      // Serialize token auth per peer — prevent concurrent authenticatePeer calls
      pendingAuth.add(peer.id);
      try {
        const headers = new Headers({
          Authorization: `Bearer ${msgData.token}`,
        });
        const authenticated = await authenticatePeer(peer, headers);
        if (authenticated) {
          // Clear the pending auth timeout — peer successfully re-authenticated
          const timeoutId = authTimeouts.get(peer.id);
          if (timeoutId) {
        logger.warn({ peerId: peer.id }, "WebSocket token auth failed");
            authTimeouts.delete(peer.id);
          }
          return;
        }
        // Token auth failed — close connection
        logger.warn(`WebSocket token auth failed for peer ${peer.id}`);
        rejectPeer(peer);
        return;
      } finally {
        pendingAuth.delete(peer.id);
      }
    }
    // Non-token message from unauthenticated peer — close
    logger.warn(
      { peerId: peer.id },
      "Closing unauthenticated WebSocket: non-token message before auth",
    );
    rejectPeer(peer);
    return;
  } catch (error) {
    logger.warn(
      { error: (error as Error)?.message },
      `WebSocket message processing error for peer ${peer.id}`,
    );
    if (!socketSessions.has(peer.id)) {
      rejectPeer(peer);
    }
  }
}

// fallow-ignore-next-line complexity
async function drainPendingAuthBuffer(peer: {
  id: string;
  send: (data: string) => void;
  close: () => void;
}): Promise<void> {
  const buf = pendingAuthMessageBuffer.get(peer.id);
  if (!buf) return;
  pendingAuthMessageBuffer.delete(peer.id);
  for (const { msg } of buf) {
    // Stop if peer was closed by an earlier buffered message
    if (!socketSessions.has(peer.id) && !pendingAuth.has(peer.id)) break;
    await processMessage(peer, msg);
  }
}

export default defineWebSocketHandler({
  async open(peer) {
    pendingAuth.add(peer.id);
        logger.warn({ peerId: peer.id }, "WebSocket auth failed");
      const authenticated = await authenticatePeer(
        peer,
        peer.request?.headers ?? new Headers(),
      );
      if (!authenticated) {
        logger.warn(`WebSocket auth failed for peer ${peer.id}`);
        peer.send("unauthenticated");
        // Allow grace period for token-based re-auth, then close
        const authTimeout = setTimeout(() => {
          if (!socketSessions.has(peer.id) && !pendingAuth.has(peer.id)) {
            peer.close();
          }
          authTimeouts.delete(peer.id);
        }, AUTH_GRACE_PERIOD_MS);
        authTimeouts.set(peer.id, authTimeout);
      }
    } catch (error) {
    } finally {
      pendingAuth.delete(peer.id);
      await drainPendingAuthBuffer(peer);
    }
    } finally {
      pendingAuth.delete(peer.id);
      while (pendingAuthMessageBuffer.has(peer.id)) {
        await drainPendingAuthBuffer(peer);
      }
    }
  },
  async message(peer, msg) {
    await processMessage(peer, msg);
    await drainPendingAuthBuffer(peer);
      return;
    }
    await processMessage(peer, msg);
    while (pendingAuthMessageBuffer.has(peer.id)) {
      await drainPendingAuthBuffer(peer);
    }
  },

  async close(peer, _details) {
    // Clean up auth-related state regardless of auth status
    pendingAuth.delete(peer.id);
    pendingAuthMessageBuffer.delete(peer.id);
    const pendingTimeout = authTimeouts.get(peer.id);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      authTimeouts.delete(peer.id);
    }

    const userId = socketSessions.get(peer.id);
    if (!userId) {
      logger.info(`skipping websocket close for ${peer.id}`);
      return;
    }

    notificationSystem.unlisten(userId, peer.id);
    notificationSystem.unlisten("system", peer.id); // In case we were listening as 'system'
    socketSessions.delete(peer.id);
  },
});
