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

  socketSessions.set(peer.id, userId);
  notificationSystem.listen(userId, acls, peer.id, (notification) => {
    peer.send(JSON.stringify(notification));
  });
  return true;
}

export default defineWebSocketHandler({
  async open(peer) {
    const authenticated = await authenticatePeer(
      peer,
      peer.request?.headers ?? new Headers(),
    );
    if (!authenticated) {
      peer.send("unauthenticated");
    }
  },
  async message(peer, msg) {
    try {
      const data = JSON.parse(msg.toString());
      if (data.token) {
        const headers = new Headers({ Authorization: `Bearer ${data.token}` });
        const authenticated = await authenticatePeer(peer, headers);
        if (authenticated) return;
      }
    } catch {
      // Invalid JSON or missing token — fall through to unauthenticated
    }
    peer.send("unauthenticated");
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
