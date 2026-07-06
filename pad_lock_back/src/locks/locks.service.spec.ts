import { LocksService } from './locks.service';

function fixture(connectedTerminalIds: string[] = []) {
  const repository = {
    query: jest.fn().mockResolvedValue([]),
  };
  const tcpConnectionsService = {
    terminalIds: jest.fn().mockReturnValue(connectedTerminalIds),
  };
  const service = new LocksService(
    repository as never,
    tcpConnectionsService as never,
  );

  return { service, repository, tcpConnectionsService };
}

describe('LocksService connection status synchronization', () => {
  it('marks every persisted lock offline when no TCP sockets are connected', async () => {
    const { service, repository } = fixture();

    await expect(service.syncStatusesWithCurrentConnections()).resolves.toEqual(
      [],
    );

    expect(repository.query).toHaveBeenCalledTimes(1);
    expect(repository.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'offline'"),
    );
    expect(repository.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE status <> 'offline'"),
    );
  });

  it('persists connected terminals online and all others offline', async () => {
    const { service, repository } = fixture(['8034400004', '8034400005']);

    await expect(service.syncStatusesWithCurrentConnections()).resolves.toEqual(
      ['8034400004', '8034400005'],
    );

    expect(repository.query).toHaveBeenCalledTimes(2);
    expect(repository.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SET status = 'online'"),
      [['8034400004', '8034400005']],
    );
    expect(repository.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SET status = 'offline'"),
      [['8034400004', '8034400005']],
    );
  });
});
