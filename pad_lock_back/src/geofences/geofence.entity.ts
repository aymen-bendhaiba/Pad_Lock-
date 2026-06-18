import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type GeofenceCoordinate = {
  lat: number;
  lng: number;
};

export type GeofenceRules = {
  smsAllowed: boolean;
  gprsAllowed: boolean;
  rfidAllowed: boolean;
  serialAllowed: boolean;
  bluetoothAllowed: boolean;
};

@Entity('geofences')
export class Geofence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'jsonb' })
  coordinates: GeofenceCoordinate[];

  @Column({ type: 'boolean', default: true })
  applyInside: boolean;

  @Column({ type: 'jsonb' })
  rules: GeofenceRules;

  @CreateDateColumn()
  createdAt: Date;
}
