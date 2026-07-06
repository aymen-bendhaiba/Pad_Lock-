import { Injectable } from '@nestjs/common';
import { Socket } from 'node:net';

export type RegisteredTcpSocket = Socket & {
  buffer?: Buffer;
  lastSerial?: number | null;
  terminalId?: string;
};

@Injectable()
export class TcpConnectionsService {
  private readonly sockets = new Map<string, RegisteredTcpSocket>();

  get(terminalId: string): RegisteredTcpSocket | undefined {
    return this.sockets.get(terminalId.toUpperCase());
  }

  set(terminalId: string, socket: RegisteredTcpSocket): void {
    this.sockets.set(terminalId.toUpperCase(), socket);
  }

  delete(terminalId: string): void {
    this.sockets.delete(terminalId.toUpperCase());
  }

  has(terminalId: string): boolean {
    return this.sockets.has(terminalId.toUpperCase());
  }

  values(): RegisteredTcpSocket[] {
    return Array.from(this.sockets.values());
  }

  terminalIds(): string[] {
    return Array.from(this.sockets.keys());
  }

  clear(): void {
    this.sockets.clear();
  }
}
