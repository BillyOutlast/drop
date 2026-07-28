import notificationSystem from "~/server/internal/notifications";
import aclManager from "~/server/internal/acls";
import { logger } from "~/server/internal/logging";

// PENDING(sonar): add web socket session management for horizontal scaling - deferred, needs distributed session store
// Peer ID to user ID
const socketSessions = new Map<string, string>();

// Grace period for unauthenticated WebSocket peers to re-authenticate via token message
const AUTH_GRACE_PERIOD_MS = 10_000;
// Track pending auth timeouts keyed by peer ID so they can be cleared on re-auth
const authTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

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
  notificationSystem.listen(userId, acls, peer.id, (notification) => {
    peer.send(JSON.stringify(notification));
  });
  return true;
}

export default defineWebSocketHandler({
  async open(peer) {
    try {
      const authenticated = await authenticatePeer(
        peer,
        peer.request?.headers ?? new Headers(),
      );
      if (!authenticated) {
        logger.warn(`WebSocket auth failed for peer ${peer.id}`);
        peer.send("unauthenticated");
        // Allow grace period for token-based re-auth, then close
        const authTimeout = setTimeout(() => {
          if (!socketSessions.has(peer.id)) {
            peer.close();
          }
          authTimeouts.delete(peer.id);
        }, AUTH_GRACE_PERIOD_MS);
        authTimeouts.set(peer.id, authTimeout);
      }
    } catch (error) {
      logger.error(
        { error: (error as Error)?.message },
        `WebSocket open auth error for peer ${peer.id}`,
      );
      peer.send("unauthenticated");
    }
  },
  async message(peer, msg) {
    try {
      const data = JSON.parse(msg.toString());
      if (data.token) {
        // Skip re-authentication if peer is already authenticated
        if (socketSessions.has(peer.id)) return;
        const headers = new Headers({ Authorization: `Bearer ${data.token}` });
        const authenticated = await authenticatePeer(peer, headers);
        if (authenticated) {
          // Clear the pending auth timeout — peer successfully re-authenticated
          const timeoutId = authTimeouts.get(peer.id);
          if (timeoutId) {
            clearTimeout(timeoutId);
            authTimeouts.delete(peer.id);
          }
          return;
        }
        // Token auth failed — close connection
        peer.send("unauthenticated");
        peer.close();
        return;
      }
      // Non-token message from authenticated peer — ignore
      if (socketSessions.has(peer.id)) return;
      // Non-token message from unauthenticated peer — close
      logger.warn(
        { peerId: peer.id },
        "Closing unauthenticated WebSocket: non-token message before auth",
      );
      peer.send("unauthenticated");
      peer.close();
      return;
    } catch (error) {
      logger.warn(
        { error: (error as Error)?.message },
        `WebSocket message auth error for peer ${peer.id}`,
      );
      peer.send("unauthenticated");
      peer.close();
    }
  },

  async close(peer, _details) {
    // Clean up any pending auth timeout
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
