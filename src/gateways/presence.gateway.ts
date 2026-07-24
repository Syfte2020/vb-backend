import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';
import { DataSource } from 'typeorm';

@WebSocketGateway({
  cors: true,
})
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private dataSource: DataSource) {}

  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId;

    if (!userId) return;

    await this.dataSource.query(
      `
      UPDATE users
      SET
        is_online = 1,
        socket_id = ?,
        last_seen = NOW()
      WHERE id = ?
      `,
      [client.id, userId],
    );

    console.log('User connected:', userId);
  }

  async handleDisconnect(client: Socket) {
    await this.dataSource.query(
      `
      UPDATE users
      SET
        is_online = 0,
        last_logout = NOW()
      WHERE socket_id = ?
      `,
      [client.id],
    );

    console.log('User disconnected');
  }

  @SubscribeMessage('heartbeat')
  async heartbeat(client: Socket, data: any) {
    await this.dataSource.query(
      `
      UPDATE users
      SET last_seen = NOW()
      WHERE id = ?
      `,
      [data.userId],
    );
  }
}