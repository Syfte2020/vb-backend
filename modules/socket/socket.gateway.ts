import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
      "http://127.0.0.1:3000",
      "https://venuebook-psi.vercel.app",
    ],

    credentials: true,
  },
})
export class SocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private onlineUsers = new Map<string, string>();

  handleConnection(client: Socket) {
    // console.log('Client connected:', client.id);
     const userId = client.handshake.query.userId as string;

  console.log("User connected:", userId);
  console.log("Socket ID:", client.id);

  if (userId) {
    this.onlineUsers.set(userId, client.id);
  }

  console.log(this.onlineUsers);
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);

    for (const [userId, socketId] of this.onlineUsers.entries()) {
      if (socketId === client.id) {
        this.onlineUsers.delete(userId);

        this.server.emit('user-status', {
          userId,
          status: 'offline',
        });

        break;
      }
    }
  }

  markOnline(userId: string, socketId: string) {
    this.onlineUsers.set(userId, socketId);

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

  realtimeApplication(userId: string ,type :string,message:string ) {
  const socketId = this.onlineUsers.get(userId);

  console.log("User:", userId);
  console.log("Socket:", socketId);

  if (socketId !== undefined) {
  console.log("Connected:", this.server.sockets.sockets.has(socketId));
}

  if (!socketId || !this.server.sockets.sockets.has(socketId)) {
    console.log("User is offline");
    return;
  }

  this.server.to(socketId).emit("realtime-status", {
    userId,
    status: "loading",
    type: type,
    message: message,
  });
}



}