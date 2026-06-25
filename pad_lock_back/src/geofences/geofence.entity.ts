import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type GeofenceCoordinate = {
  lat: number;
  lng: number;
};

export enum GeofenceShapeType {
  Polygon = 'polygon',
  Circle = 'circle',
  Route = 'route',
}

export enum GeofenceAccessMode {
  AllowInside = 'allow_inside',
  AllowOutside = 'allow_outside',
}

export type GeofenceRules = {
  smsAllowed: boolean;
  gprsAllowed: boolean;
  rfidAllowed: boolean;
  serialAllowed: boolean;
  bluetoothAllowed: boolean;
  lockAccessAllowed: boolean;
};

@Entity('geofences')
@Index(['geoBoundaryId'])
@Index(['createdAt'])
export class Geofence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  terminalIds: string[];

  @Column({ type: 'uuid', nullable: true })
  geoBoundaryId: string | null;

  @Column({
    type: 'enum',
    enum: GeofenceShapeType,
    default: GeofenceShapeType.Polygon,
  })
  shapeType: GeofenceShapeType;

  @Column({ type: 'jsonb' })
  coordinates: GeofenceCoordinate[];

  @Column({ type: 'double precision', nullable: true })
  radiusMeters: number | null;

  @Column({ type: 'boolean', default: true })
  applyInside: boolean;

  @Column({
    type: 'enum',
    enum: GeofenceAccessMode,
    default: GeofenceAccessMode.AllowInside,
  })
  accessMode: GeofenceAccessMode;

  @Column({ type: 'jsonb' })
  rules: GeofenceRules;

  @CreateDateColumn()
  createdAt: Date;
}
