import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum GeoBoundaryType {
  Continent = 'continent',
  Country = 'country',
  City = 'city',
  Region = 'region',
}

@Entity('geo_boundaries')
@Index(['type', 'name'])
@Index(['countryCode'])
export class GeoBoundary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: GeoBoundaryType })
  type: GeoBoundaryType;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 3, nullable: true })
  countryCode: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  continent: string | null;

  @Column({ type: 'jsonb' })
  bbox: number[];

  @Column({ type: 'jsonb' })
  metadata: Record<string, unknown>;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Geometry',
    srid: 4326,
    select: false,
  })
  geometry: unknown;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
