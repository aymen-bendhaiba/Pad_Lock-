import {
  buildReportingIntervalsSetCommand,
  buildStaticUnlockCommand,
  buildStaticPasswordModifyCommand,
  buildStaticPasswordQueryCommand,
  buildSimConfigurationQueryCommand,
  buildSimConfigurationSetCommand,
  buildVibrationLevelSetCommand,
} from './jt701d-commands';

describe('JT701D configuration commands', () => {
  it('builds P43 static unlock commands without surrounding password whitespace', () => {
    expect(buildStaticUnlockCommand(' 888889 ')).toBe('(P43,888889)');
  });

  it('builds SIM1 and SIM2 P06 commands', () => {
    const input = {
      ipAddress: 'jt701.jointcontrols.com',
      port: 10001,
      apn: 'CMIOT',
      apnUser: 'user',
      apnPassword: 'pass',
    };

    expect(buildSimConfigurationSetCommand(1, input)).toBe(
      '(P06,1,jt701.jointcontrols.com,10001,CMIOT,user,pass)',
    );
    expect(buildSimConfigurationSetCommand(2, input)).toBe(
      '(P06,3,jt701.jointcontrols.com,10001,CMIOT,user,pass)',
    );
    expect(buildSimConfigurationQueryCommand(1)).toBe('(P06,0)');
    expect(buildSimConfigurationQueryCommand(2)).toBe('(P06,2)');
  });

  it('builds P04 reporting and P37 vibration commands', () => {
    expect(buildReportingIntervalsSetCommand(30, 60)).toBe('(P04,1,30,60)');
    expect(buildVibrationLevelSetCommand(126)).toBe('(P37,1,126)');
  });

  it('builds P44 static password modify and query commands', () => {
    expect(buildStaticPasswordModifyCommand('888888', '123456')).toBe(
      '(P44,123456,888888)',
    );
    expect(buildStaticPasswordQueryCommand()).toBe('(P44,1)');
  });
});
