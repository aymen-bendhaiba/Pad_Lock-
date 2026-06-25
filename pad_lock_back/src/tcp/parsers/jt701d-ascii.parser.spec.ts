import { parseAsciiFrame } from './jt701d-ascii.parser';

describe('JT701D P45 parser', () => {
  it('treats RFID verification value 98 as a successful unlock', () => {
    const parsed = parseAsciiFrame(
      '(8034400004,P45,230626,162700,33.96009,N,6.86392,W,A,0,0,1,98,0006950536,0,0,38,41)',
    );

    expect(parsed).toEqual(
      expect.objectContaining({
        kind: 'p45_report',
        eventSourceCode: '1',
        unlockVerification: 'Pass',
        rfidCard: '0006950536',
      }),
    );
  });

  it('treats RFID verification value 99 as rejected outside a fence', () => {
    const parsed = parseAsciiFrame(
      '(8000400055,P45,040121,104728,22.55801,N,114.00846,E,A,0,244,1,99,0008627839,0,0,2,29)',
    );

    expect(parsed).toEqual(
      expect.objectContaining({
        kind: 'p45_report',
        unlockVerification: 'Reject',
      }),
    );
  });

  it('treats static password value 1 as successful', () => {
    const parsed = parseAsciiFrame(
      '(8000400055,P45,060121,081257,22.58047,N,113.91753,E,A,0,0,4,1,0000000000,1,0,5,58)',
    );

    expect(parsed).toEqual(
      expect.objectContaining({
        kind: 'p45_report',
        eventSourceCode: '4',
        unlockVerification: 'Pass',
        passwordCorrect: true,
      }),
    );
  });
});
