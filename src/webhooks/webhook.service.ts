import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { v4 as uuid } from 'uuid';
import { ReceiveWebhookDto } from './webhook.dto';
import { WebhookStore } from './webhook.store';
import { DeliveryAttempt, WebhookEvent } from './webhook.types';

@Injectable()
export class WebhookService {
  private readonly secret = process.env.WEBHOOK_SECRET ?? 'local-development-secret';
  private readonly maxAttempts = Number(process.env.MAX_DELIVERY_ATTEMPTS ?? 5);

  constructor(private readonly store: WebhookStore) {}

  receive(dto: ReceiveWebhookDto, signature: string | undefined): WebhookEvent {
    this.verifySignature(dto.payload, signature);
    if (this.store.findByEventId(dto.eventId)) {
      throw new ConflictException('Duplicate eventId');
    }

    const event: WebhookEvent = {
      id: uuid(),
      eventId: dto.eventId,
      eventType: dto.eventType,
      destinationUrl: dto.destinationUrl,
      payload: dto.payload,
      status: 'PENDING',
      receivedAt: new Date().toISOString(),
      attempts: [],
    };
    return this.store.save(event);
  }

  get(id: string): WebhookEvent {
    const event = this.store.findById(id);
    if (!event) throw new NotFoundException('Webhook event not found');
    return event;
  }

  recordDelivery(id: string, statusCode: number, error?: string): WebhookEvent {
    const event = this.get(id);
    const attemptNumber = event.attempts.length + 1;
    const retryable = statusCode === 408 || statusCode === 429 || statusCode >= 500;
    const delivered = statusCode >= 200 && statusCode < 300;

    const attempt: DeliveryAttempt = {
      attempt: attemptNumber,
      statusCode,
      error,
      attemptedAt: new Date().toISOString(),
    };

    if (delivered) {
      event.status = 'DELIVERED';
    } else if (retryable && attemptNumber < this.maxAttempts) {
      const delaySeconds = Math.min(60, 2 ** attemptNumber);
      attempt.nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
      event.status = 'RETRYING';
    } else {
      event.status = 'DEAD_LETTER';
    }

    event.attempts.push(attempt);
    return this.store.save(event);
  }

  replay(id: string): WebhookEvent {
    const event = this.get(id);
    event.status = 'PENDING';
    return this.store.save(event);
  }

  private verifySignature(payload: Record<string, unknown>, signature?: string): void {
    if (!signature) throw new UnauthorizedException('Missing x-webhook-signature');
    const expected = createHmac('sha256', this.secret).update(JSON.stringify(payload)).digest('hex');
    const actual = signature.replace(/^sha256=/, '');
    if (actual.length !== expected.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
