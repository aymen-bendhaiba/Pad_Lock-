import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateLockDeviceDto } from './dto/create-lock-device.dto';
import { FindLocksQueryDto } from './dto/find-locks-query.dto';
import { UpdateLockDeviceDto } from './dto/update-lock-device.dto';
import { LocksService } from './locks.service';

@UseGuards(JwtAuthGuard)
@Controller('locks')
export class LocksController {
  constructor(private readonly locksService: LocksService) {}

  @Get()
  findAll(@Query() query: FindLocksQueryDto) {
    return this.locksService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateLockDeviceDto) {
    return this.locksService.create(dto);
  }

  @Get(':terminalId')
  findOne(@Param('terminalId') terminalId: string) {
    return this.locksService.findCurrentByTerminalIdOrFail(terminalId);
  }

  @Patch(':terminalId')
  update(
    @Param('terminalId') terminalId: string,
    @Body() dto: UpdateLockDeviceDto,
  ) {
    return this.locksService.update(terminalId, dto);
  }
}
