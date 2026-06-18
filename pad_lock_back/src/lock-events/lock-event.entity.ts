import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LockDevice } from '../locks/lock-device.entity';

export enum LockEventType {
  Locked = 'locked',
  Unlocked = 'unlocked',
  UnlockRejected = 'unlock_rejected',
  IllegalRfid = 'illegal_rfid',
  LockRopeCut = 'lock_rope_cut',
  LongUnlock = 'long_unlock',
  WrongPassword = 'wrong_password',
  LowBattery = 'low_battery',
  BackCoverOpened = 'back_cover_opened',
  Vibration = 'vibration',
  MotorStuck = 'motor_stuck',
  Other = 'other',
}

export enum LockEventSeverity {
  Info = 'info',
  Warning = 'warning',
  Critical = 'critical',
}

@Entity('lock_events')
export class LockEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  lockDeviceId: string;

  @ManyToOne(() => LockDevice, (lockDevice) => lockDevice.events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'lockDeviceId' })
  lockDevice: LockDevice;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  terminalId: string;

  @Index()
  @Column({ type: 'enum', enum: LockEventType })
  type: LockEventType;

  @Column({ type: 'enum', enum: LockEventSeverity })
  severity: LockEventSeverity;

  @Column({ type: 'varchar', length: 120, nullable: true })
  source: string | null;

  @Column({ type: 'char', length: 10, nullable: true })
  rfidCardNumber: string | null;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ type: 'jsonb', nullable: true })
  rawPayload: Record<string, unknown> | null;

  @Index()
  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  @CreateDateColumn()
  receivedAt: Date;
}
