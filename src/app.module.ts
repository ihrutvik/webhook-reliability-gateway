import { Module } from '@nestjs/common';
import { WebhookController } from './webhooks/webhook.controller';
import { WebhookService } from './webhooks/webhook.service';
import { WebhookStore } from './webhooks/webhook.store';
import { WebhookWorker } from './webhooks/webhook.worker';

@Module({
  controllers: [WebhookController],
  providers: [WebhookStore, WebhookService, WebhookWorker],
})
export class AppModule {}
