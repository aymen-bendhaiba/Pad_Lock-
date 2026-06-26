import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RfidCardsDto, UpdateRfidCardRoleDto } from './dto/rfid-cards.dto';
import { FindRfidCardsQueryDto } from './dto/find-rfid-cards-query.dto';
import { RfidService } from './rfid.service';

@UseGuards(JwtAuthGuard)
@Controller('locks/:terminalId/rfid-cards')
export class RfidController {
  constructor(private readonly rfidService: RfidService) {}

  @Get()
  findForLock(
    @Param('terminalId') terminalId: string,
    @Query() query: FindRfidCardsQueryDto,
  ) {
    return this.rfidService.findForLock(terminalId, query);
  }

  @Post()
  addCards(@Param('terminalId') terminalId: string, @Body() dto: RfidCardsDto) {
    return this.rfidService.addCards(terminalId, dto);
  }

  @Post('sync')
  syncCurrentGeofenceState(@Param('terminalId') terminalId: string) {
    return this.rfidService.syncCurrentGeofenceState(terminalId);
  }

  @Delete()
  deleteCards(
    @Param('terminalId') terminalId: string,
    @Body() dto: RfidCardsDto,
  ) {
    return this.rfidService.deleteCards(terminalId, dto);
  }

  @Put(':cardNumber/role')
  updateCardRole(
    @Param('terminalId') terminalId: string,
    @Param('cardNumber') cardNumber: string,
    @Body() dto: UpdateRfidCardRoleDto,
  ) {
    return this.rfidService.updateCardRole(terminalId, cardNumber, dto.role);
  }

  @Delete('all')
  clearCards(@Param('terminalId') terminalId: string) {
    return this.rfidService.clearCards(terminalId);
  }

  @Get('groups/:group')
  queryGroupCommand(
    @Param('terminalId') terminalId: string,
    @Param('group', ParseIntPipe) group: number,
  ) {
    return this.rfidService.queryGroupCommand(terminalId, group);
  }
}
