import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GeoBoundaryQueryDto } from './dto/geo-boundary-query.dto';
import { GeoBoundariesService } from './geo-boundaries.service';

@UseGuards(JwtAuthGuard)
@Controller('geo-boundaries')
export class GeoBoundariesController {
  constructor(private readonly geoBoundariesService: GeoBoundariesService) {}

  @Get()
  search(@Query() query: GeoBoundaryQueryDto) {
    return this.geoBoundariesService.search(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.geoBoundariesService.findOne(id);
  }
}
