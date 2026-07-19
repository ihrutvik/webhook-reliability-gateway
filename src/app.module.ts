import { Module } from '@nestjs/common';
import { WebhookController } from './webhooks/webhook.controller';
import { WebhookService } from './webhooks/webhook.service';

@Module({
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class AppModule {}
