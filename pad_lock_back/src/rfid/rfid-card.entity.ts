import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { LockDevice } from '../locks/lock-device.entity';

export enum RfidCardRole {
  Admin = 'admin',
  Limited = 'limited',
}

export enum RfidCardSyncStatus {
  Synced = 'synced',
  PendingAdd = 'pending_add',
  PendingDelete = 'pending_delete',
  Failed = 'failed',
}

@Entity('rfid_cards')
@Unique(['lockDeviceId', 'cardNumber'])
@Index(['lockDeviceId', 'active', 'createdAt'])
@Index(['lockDeviceId', 'role', 'active'])
@Index(['lockDeviceId', 'role', 'active', 'installedOnLock'])
@Index(['lockDeviceId', 'lastSyncStatus'])
export class RfidCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  lockDeviceId: string;

  @ManyToOne(() => LockDevice, (lockDevice) => lockDevice.rfidCards, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'lockDeviceId' })
  lockDevice: LockDevice;

  @Index()
  @Column({ type: 'char', length: 10 })
  cardNumber: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  label: string | null;

  @Column({
    type: 'enum',
    enum: RfidCardRole,
    default: RfidCardRole.Limited,
  })
  role: RfidCardRole;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'boolean', default: false })
  installedOnLock: boolean;

  @Column({
    type: 'enum',
    enum: RfidCardSyncStatus,
    default: RfidCardSyncStatus.PendingAdd,
  })
  lastSyncStatus: RfidCardSyncStatus;

  @Column({ type: 'text', nullable: true })
  lastSyncError: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
