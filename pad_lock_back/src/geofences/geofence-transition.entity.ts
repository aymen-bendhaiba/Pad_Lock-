import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum GeofenceTransitionType {
  Enter = 'enter',
  Exit = 'exit',
}

@Entity('geofence_transitions')
@Index(['terminalId', 'occurredAt'])
@Index(['geofenceId', 'occurredAt'])
export class GeofenceTransition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  terminalId: string;

  @Column({ type: 'uuid' })
  geofenceId: string;

  @Column({ type: 'varchar', length: 120 })
  geofenceName: string;

  @Column({ type: 'varchar', length: 12 })
  type: GeofenceTransitionType;

  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  @CreateDateColumn()
  receivedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
