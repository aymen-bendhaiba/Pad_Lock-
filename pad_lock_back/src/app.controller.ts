import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHealth() {
    return {
      name: 'Lock Management API',
      status: 'ok',
    };
  }
}
