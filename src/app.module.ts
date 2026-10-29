import { Module } from '@nestjs/common';
import { TicketsModule } from './tickets/tickets.module.js';
@Module({
  imports: [TicketsModule],
})
export class AppModule {}
