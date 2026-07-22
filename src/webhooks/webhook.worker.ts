import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookStore } from './webhook.store';

@Injectable()
export class WebhookWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly store: WebhookStore,
    private readonly service: WebhookService,
  ) {}

  onModuleInit(): void {
    const intervalMs = Number(process.env.DELIVERY_POLL_INTERVAL_MS ?? 2000);
    this.timer = setInterval(() => void this.processReadyEvents(), intervalMs);
    void this.processReadyEvents();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async processReadyEvents(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (const event of this.store.findReadyForDelivery()) {
        try {
          const response = await fetch(event.destinationUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-webhook-event-id': event.eventId,
              'x-webhook-event-type': event.eventType,
            },
            body: JSON.stringify(event.payload),
            signal: AbortSignal.timeout(Number(process.env.DELIVERY_TIMEOUT_MS ?? 5000)),
          });
          this.service.recordDelivery(event.id, response.status);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown delivery failure';
          this.logger.warn(`Delivery failed for ${event.eventId}: ${message}`);
          this.service.recordDelivery(event.id, 503, message);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
