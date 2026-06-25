import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LockEvent } from '../lock-events/lock-event.entity';
import { RfidCard } from '../rfid/rfid-card.entity';

export enum LockDeviceStatus {
  Unknown = 'unknown',
  Online = 'online',
  Offline = 'offline',
}

@Entity('lock_devices')
export class LockDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  terminalId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  imei: string | null;

  @Column({
    type: 'enum',
    enum: LockDeviceStatus,
    default: LockDeviceStatus.Unknown,
  })
  status: LockDeviceStatus;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @OneToMany(() => RfidCard, (card) => card.lockDevice)
  rfidCards: RfidCard[];

  @OneToMany(() => LockEvent, (event) => event.lockDevice)
  events: LockEvent[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
