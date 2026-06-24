import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpdateLockConfigurationDto } from './dto/update-lock-configuration.dto';
import { LockConfigurationsService } from './lock-configurations.service';

@UseGuards(JwtAuthGuard)
@Controller('locks/:terminalId/configuration')
export class LockConfigurationsController {
  constructor(
    private readonly lockConfigurationsService: LockConfigurationsService,
  ) {}

  @Get()
  findOne(@Param('terminalId') terminalId: string) {
    return this.lockConfigurationsService.findOne(terminalId);
  }

  @Patch()
  update(
    @Param('terminalId') terminalId: string,
    @Body() dto: UpdateLockConfigurationDto,
  ) {
    return this.lockConfigurationsService.update(terminalId, dto);
  }
}
