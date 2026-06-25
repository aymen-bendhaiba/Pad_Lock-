import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateLockConfigurationDto } from './update-lock-configuration.dto';

describe('UpdateLockConfigurationDto', () => {
  it('accepts protocol boundary values', async () => {
    const dto = plainToInstance(UpdateLockConfigurationDto, {
      sim1: {
        ipAddress: '127.0.0.1',
        port: 65530,
        apn: 'internet',
        apnUser: '',
        apnPassword: '',
      },
      trackingUploadIntervalSeconds: 5,
      wakeUpIntervalMinutes: 1440,
      vibrationLevelMg: 500,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects nulls, out-of-range values, and protocol delimiters', async () => {
    const dto = plainToInstance(UpdateLockConfigurationDto, {
      sim1: null,
      sim2: {
        ipAddress: 'host,invalid',
        port: 65531,
        apn: 'internet',
      },
      trackingUploadIntervalSeconds: 4,
      wakeUpIntervalMinutes: 1441,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'sim1',
        'sim2',
        'trackingUploadIntervalSeconds',
        'wakeUpIntervalMinutes',
      ]),
    );
  });
});
