import {
  buildReportingIntervalsSetCommand,
  buildSimConfigurationSetCommand,
  buildVibrationLevelSetCommand,
} from './jt701d-commands';

describe('JT701D configuration commands', () => {
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
  });

  it('builds P04 reporting and P37 vibration commands', () => {
    expect(buildReportingIntervalsSetCommand(30, 60)).toBe('(P04,1,30,60)');
    expect(buildVibrationLevelSetCommand(126)).toBe('(P37,1,126)');
  });
});
