import notificationSystem from "~/server/internal/notifications";
import aclManager from "~/server/internal/acls";
import { logger } from "~/server/internal/logging";

// PENDING(sonar): add web socket session management for horizontal scaling - deferred, needs distributed session store
// Peer ID to user ID
const socketSessions = new Map<string, string>();

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
        peer.close();
      }
    } catch (error) {
      logger.error({ error }, `WebSocket open auth error for peer ${peer.id}`);
      peer.send("unauthenticated");
      peer.close();
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
        if (authenticated) return;
      }
    } catch (error) {
      logger.warn(
        { error },
        `WebSocket message auth error for peer ${peer.id}`,
      );
    }
    peer.send("unauthenticated");
    peer.close();
  },

  async close(peer, _details) {
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
