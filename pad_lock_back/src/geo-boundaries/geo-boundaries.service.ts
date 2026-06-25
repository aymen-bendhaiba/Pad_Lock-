import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { GeoBoundaryQueryDto } from './dto/geo-boundary-query.dto';
import { GeoBoundary } from './geo-boundary.entity';

@Injectable()
export class GeoBoundariesService {
  constructor(
    @InjectRepository(GeoBoundary)
    private readonly geoBoundariesRepository: Repository<GeoBoundary>,
    private readonly dataSource: DataSource,
  ) {}

  async search(query: GeoBoundaryQueryDto) {
    const builder = this.geoBoundariesRepository
      .createQueryBuilder('boundary')
      .select([
        'boundary.id',
        'boundary.type',
        'boundary.name',
        'boundary.countryCode',
        'boundary.continent',
        'boundary.bbox',
        'boundary.createdAt',
        'boundary.updatedAt',
      ])
      .orderBy('boundary.name', 'ASC')
      .skip(((query.page ?? 1) - 1) * (query.limit ?? 50))
      .take(query.limit ?? 50);

    if (query.includeMetadata) {
      builder.addSelect('boundary.metadata');
    }

    if (query.type) {
      builder.andWhere('boundary.type = :type', { type: query.type });
    }

    if (query.search?.trim()) {
      builder.andWhere('boundary.name ILIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    }

    if (query.countryCode?.trim()) {
      builder.andWhere('boundary.countryCode = :countryCode', {
        countryCode: query.countryCode.trim().toUpperCase(),
      });
    }

    if (query.continent?.trim()) {
      builder.andWhere('LOWER(boundary.continent) = :continent', {
        continent: query.continent.trim().toLowerCase(),
      });
    }

    return builder.getMany();
  }

  async findOne(id: string) {
    const rows = await this.dataSource.query<
      Array<
        Omit<GeoBoundary, 'geometry'> & {
          geometry: Record<string, unknown>;
        }
      >
    >(
      `
        SELECT
          id,
          type,
          name,
          "countryCode",
          continent,
          bbox,
          metadata,
          ST_AsGeoJSON(geometry)::json AS geometry,
          "createdAt",
          "updatedAt"
        FROM geo_boundaries
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    const boundary = rows[0];

    if (!boundary) {
      throw new NotFoundException('Geo boundary not found');
    }

    return boundary;
  }

  async pointIsInside(id: string, latitude: number, longitude: number) {
    const rows = await this.dataSource.query<Array<{ inside: boolean }>>(
      `
        SELECT ST_Covers(
          geometry,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)
        ) AS inside
        FROM geo_boundaries
        WHERE id = $3
        LIMIT 1
      `,
      [latitude, longitude, id],
    );

    if (!rows[0]) {
      throw new NotFoundException('Geo boundary not found');
    }

    return rows[0].inside;
  }
}
