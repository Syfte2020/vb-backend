import { Injectable } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';

@Injectable()
export class SocketService {
  constructor(private gateway: SocketGateway) {}

  online(userId: string, socketId: string = '') {
    this.gateway.markOnline(userId, socketId);
  }

  offline(userId: string) {
    this.gateway.markOffline(userId);
  }
  
  realtime(userId: string,type:string,message:string) {
  this.gateway.realtimeApplication(userId,type,message);
}
}