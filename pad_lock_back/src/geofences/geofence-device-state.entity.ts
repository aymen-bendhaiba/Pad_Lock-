import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('geofence_device_states')
@Unique(['terminalId', 'geofenceId'])
@Index(['terminalId'])
export class GeofenceDeviceState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  terminalId: string;

  @Column({ type: 'uuid' })
  geofenceId: string;

  @Column({ type: 'boolean' })
  isInside: boolean;

  @Column({ type: 'timestamptz' })
  lastObservedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastChangedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
