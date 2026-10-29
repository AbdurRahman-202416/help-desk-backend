import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';
import { RequestLoggerMiddleware } from './common/request-logger.middleware.js';

@Module({
  controllers: [TicketsController],
  providers: [TicketsService]
})
export class TicketsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes(TicketsController);
  }
}
