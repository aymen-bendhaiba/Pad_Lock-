import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LockDevice } from '../locks/lock-device.entity';

export enum LockConfigurationSyncStatus {
  Synced = 'synced',
  Pending = 'pending',
  Failed = 'failed',
}

@Entity('lock_configurations')
export class LockConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  lockDeviceId: string;

  @OneToOne(() => LockDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lockDeviceId' })
  lockDevice: LockDevice;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sim1IpAddress: string | null;

  @Column({ type: 'integer', nullable: true })
  sim1Port: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sim1Apn: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sim1ApnUser: string | null;

  @Column({ type: 'text', nullable: true })
  sim1ApnPasswordEncrypted: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sim2IpAddress: string | null;

  @Column({ type: 'integer', nullable: true })
  sim2Port: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sim2Apn: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sim2ApnUser: string | null;

  @Column({ type: 'text', nullable: true })
  sim2ApnPasswordEncrypted: string | null;

  @Column({ type: 'integer', default: 30 })
  trackingUploadIntervalSeconds: number;

  @Column({ type: 'integer', default: 30 })
  wakeUpIntervalMinutes: number;

  @Column({ type: 'integer', default: 126 })
  vibrationLevelMg: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  sim1SyncStatus: LockConfigurationSyncStatus | null;

  @Column({ type: 'text', nullable: true })
  sim1SyncError: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sim1SyncedAt: Date | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  sim2SyncStatus: LockConfigurationSyncStatus | null;

  @Column({ type: 'text', nullable: true })
  sim2SyncError: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sim2SyncedAt: Date | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  reportingSyncStatus: LockConfigurationSyncStatus | null;

  @Column({ type: 'text', nullable: true })
  reportingSyncError: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reportingSyncedAt: Date | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  vibrationSyncStatus: LockConfigurationSyncStatus | null;

  @Column({ type: 'text', nullable: true })
  vibrationSyncError: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  vibrationSyncedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
