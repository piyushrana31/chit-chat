export class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.onlineUsers = new Set();
  }

  addConnection(userId, socket) {
    const normalized = String(userId);
    this.connections.set(normalized, socket);
    this.onlineUsers.add(normalized);
    socket.userId = normalized;
    return socket;
  }

  removeConnection(userId, socket) {
    const normalized = String(userId);

    if (socket && this.connections.get(normalized) !== socket) {
      return false;
    }

    this.connections.delete(normalized);
    this.onlineUsers.delete(normalized);
    return true;
  }

  getConnection(userId) {
    return this.connections.get(String(userId));
  }

  getOnlineUsers() {
    return Array.from(this.onlineUsers);
  }

  isOnline(userId) {
    return this.onlineUsers.has(String(userId));
  }
}
