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

@Entity('rfid_cards')
@Unique(['lockDeviceId', 'cardNumber'])
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

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
