import { CommandsService } from './commands.service';

type CommandParser = (parts: string[]) => unknown;

describe('CommandsService unlock', () => {
  it('returns a clear success message for accepted P43 responses', async () => {
    const tcpGatewayService = {
      sendCommand: jest.fn(
        (_terminalId, _word, _command, parser: CommandParser) =>
          Promise.resolve(parser(['P43', '1'])),
      ),
    };
    const service = new CommandsService(tcpGatewayService as never);

    await expect(
      service.unlock({ terminalId: '8034400004', password: '888888' }),
    ).resolves.toEqual({
      command: '(P43,888888)',
      success: true,
      resultCode: '1',
      errorCode: null,
      message: 'Unlock command accepted by the lock.',
    });
  });

  it('returns a clear failure message for rejected P43 responses', async () => {
    const tcpGatewayService = {
      sendCommand: jest.fn(
        (_terminalId, _word, _command, parser: CommandParser) =>
          Promise.resolve(parser(['P43', '0'])),
      ),
    };
    const service = new CommandsService(tcpGatewayService as never);

    await expect(
      service.unlock({ terminalId: '8034400004', password: '888888' }),
    ).resolves.toEqual({
      command: '(P43,888888)',
      success: false,
      resultCode: '0',
      errorCode: null,
      message:
        'Unlock command was rejected or failed on the lock. Check the static password, lock state, and whether lock access is currently blocked by device settings.',
    });
  });
});

describe('CommandsService VIP phone queries', () => {
  it('enables SMS alerts for the slot when adding a VIP phone', async () => {
    const tcpGatewayService = {
      sendCommand: jest.fn(
        (_terminalId, _word, command: string, parser: CommandParser) => {
          if (command.startsWith('(P11,1,')) {
            return Promise.resolve(
              parser(['8034400004', 'P11', '2', '+212600000002']),
            );
          }
          if (command === '(P12,0)') {
            return Promise.resolve(
              parser(['8034400004', 'P12', '1', '0', '0', '1', '0']),
            );
          }

          return Promise.resolve(
            parser(['8034400004', 'P12', '1', '1', '0', '1', '0']),
          );
        },
      ),
    };
    const service = new CommandsService(tcpGatewayService as never);

    await expect(
      service.setVipPhone({
        terminalId: '8034400004',
        index: 2,
        phoneNumber: '+212600000002',
      }),
    ).resolves.toMatchObject({
      success: true,
      index: 2,
      phoneNumber: '+212600000002',
      smsAlertEnabled: true,
      smsAlerts: {
        vip1: 1,
        vip2: 1,
        vip3: 0,
        vip4: 1,
        vip5: 0,
      },
    });
    expect(
      tcpGatewayService.sendCommand.mock.calls.map((call) => call[2]),
    ).toEqual(['(P11,1,2,+212600000002)', '(P12,0)', '(P12,1,1,1,0,1,0)']);
  });

  it('queries one VIP phone slot when index is provided', async () => {
    const tcpGatewayService = {
      sendCommand: jest.fn(
        (_terminalId, _word, _command, parser: CommandParser) =>
          Promise.resolve(parser(['8034400004', 'P11', '3', '+212600000003'])),
      ),
    };
    const service = new CommandsService(tcpGatewayService as never);

    await expect(service.queryVipPhones('8034400004', 3)).resolves.toEqual({
      success: true,
      index: 3,
      phoneNumber: '+212600000003',
    });
    expect(tcpGatewayService.sendCommand).toHaveBeenCalledWith(
      '8034400004',
      'P11',
      '(P11,0,3)',
      expect.any(Function),
    );
  });

  it('queries all five VIP phone slots when index is omitted', async () => {
    const tcpGatewayService = {
      sendCommand: jest.fn(
        (_terminalId, _word, command: string, parser: CommandParser) => {
          const index = command.match(/\(P11,0,(\d)\)/)?.[1] ?? '0';
          return Promise.resolve(
            parser(['8034400004', 'P11', index, `+21260000000${index}`]),
          );
        },
      ),
    };
    const service = new CommandsService(tcpGatewayService as never);

    await expect(service.queryVipPhones('8034400004')).resolves.toEqual({
      success: true,
      terminalId: '8034400004',
      phones: [
        { success: true, index: 1, phoneNumber: '+212600000001' },
        { success: true, index: 2, phoneNumber: '+212600000002' },
        { success: true, index: 3, phoneNumber: '+212600000003' },
        { success: true, index: 4, phoneNumber: '+212600000004' },
        { success: true, index: 5, phoneNumber: '+212600000005' },
      ],
    });
    expect(tcpGatewayService.sendCommand).toHaveBeenCalledTimes(5);
  });

  it('deletes one VIP phone slot and disables its SMS alerts', async () => {
    const tcpGatewayService = {
      sendCommand: jest.fn(
        (_terminalId, _word, command: string, parser: CommandParser) => {
          if (command.startsWith('(P11,1,')) {
            return Promise.resolve(parser(['8034400004', 'P11', '4', '']));
          }
          if (command === '(P12,0)') {
            return Promise.resolve(
              parser(['8034400004', 'P12', '1', '1', '1', '1', '1']),
            );
          }

          return Promise.resolve(
            parser(['8034400004', 'P12', '1', '1', '1', '0', '1']),
          );
        },
      ),
    };
    const service = new CommandsService(tcpGatewayService as never);

    await expect(service.deleteVipPhone('8034400004', 4)).resolves.toEqual({
      success: true,
      index: 4,
      phoneNumber: '',
      deleted: true,
      smsAlertEnabled: false,
      smsAlerts: {
        success: true,
        vip1: 1,
        vip2: 1,
        vip3: 1,
        vip4: 0,
        vip5: 1,
      },
    });
    expect(
      tcpGatewayService.sendCommand.mock.calls.map((call) => call[2]),
    ).toEqual(['(P11,1,4,)', '(P12,0)', '(P12,1,1,1,1,0,1)']);
  });
});
