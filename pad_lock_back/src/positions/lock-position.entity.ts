import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LockDevice } from '../locks/lock-device.entity';

@Entity('lock_positions')
@Index(['terminalId', 'recordedAt'])
@Index(['deletedAt', 'recordedAt'])
export class LockPosition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  lockDeviceId: string;

  @ManyToOne(() => LockDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lockDeviceId' })
  lockDevice: LockDevice;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  terminalId: string;

  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Column({ type: 'double precision', nullable: true })
  speedKmh: number | null;

  @Column({ type: 'integer', nullable: true })
  directionDegrees: number | null;

  @Column({ type: 'integer', nullable: true })
  batteryPercentage: number | null;

  @Column({ type: 'boolean', default: false })
  isCharging: boolean;

  @Column({ type: 'boolean', nullable: true })
  isLocked: boolean | null;

  @Column({ type: 'boolean', default: false })
  isPositioned: boolean;

  @Column({ type: 'integer', nullable: true })
  mileage: number | null;

  @Column({ type: 'jsonb', nullable: true })
  rawPayload: Record<string, unknown> | null;

  @Index()
  @Column({ type: 'timestamptz' })
  recordedAt: Date;

  @CreateDateColumn()
  receivedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
