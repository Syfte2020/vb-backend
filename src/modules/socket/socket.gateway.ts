import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: [
      'https://venuebook.in',
      'https://www.venuebook.in',
      'https://admin.venuebook.in',
      'http://localhost:3000',
    ],
    credentials: true,
  },
})
export class SocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);

  // userId -> set of socket ids (supports multiple tabs/devices per user)
  private onlineUsers = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    // TODO(security): userId is currently trusted from an unauthenticated
    // query param — anyone can connect as any userId and receive that
    // user's realtime events. Replace this with a verified value, e.g.
    // decoded from a JWT passed in client.handshake.auth.token, before
    // this gateway is exposed publicly.
    const userId = this.extractUserId(client);

    if (!userId) {
      this.logger.warn(`Socket ${client.id} connected without a userId`);
      return;
    }

    const wasOffline = !this.onlineUsers.has(userId);

    if (!this.onlineUsers.has(userId)) {
      this.onlineUsers.set(userId, new Set());
    }
    this.onlineUsers.get(userId)!.add(client.id);

    this.logger.debug(`User connected: ${userId} (socket ${client.id})`);

    // Only broadcast "online" the first time this user has any active socket
    if (wasOffline) {
      this.server.emit('user-status', {
        userId,
        status: 'online',
      });
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);

    for (const [userId, socketIds] of this.onlineUsers.entries()) {
      if (!socketIds.has(client.id)) continue;

      socketIds.delete(client.id);

      // Only mark the user fully offline once their last socket disconnects
      if (socketIds.size === 0) {
        this.onlineUsers.delete(userId);

        this.server.emit('user-status', {
          userId,
          status: 'offline',
        });
      }

      break;
    }
  }

  markOnline(userId: string, socketId: string) {
    if (!this.onlineUsers.has(userId)) {
      this.onlineUsers.set(userId, new Set());
    }
    this.onlineUsers.get(userId)!.add(socketId);

    this.server.emit('user-status', {
      userId,
      status: 'online',
    });
  }

  markOffline(userId: string) {
    this.onlineUsers.delete(userId);

    this.server.emit('user-status', {
      userId,
      status: 'offline',
    });
  }

  realtimeApplication(userId: string, type: string, message: string) {
    const socketIds = this.onlineUsers.get(userId);

    if (!socketIds || socketIds.size === 0) {
      this.logger.debug(`realtimeApplication: user ${userId} is offline`);
      return;
    }

    for (const socketId of socketIds) {
      if (!this.server.sockets.sockets.has(socketId)) continue;

      this.server.to(socketId).emit('realtime-status', {
        userId,
        status: 'loading',
        type,
        message,
      });
    }
  }

  broadcast(payload: { text: string; message: string }) {
    this.server.emit('announcement-status', payload);
  }

  private extractUserId(client: Socket): string | null {
    const raw = client.handshake.query.userId;
    const userId = Array.isArray(raw) ? raw[0] : raw;
    return userId ?? null;
  }
}