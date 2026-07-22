import { createHmac } from 'crypto';
import { ConflictException } from '@nestjs/common';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { WebhookService } from './webhook.service';
import { WebhookStore } from './webhook.store';

const payload = { orderId: 'order-101', status: 'paid' };
const signature = createHmac('sha256', 'local-development-secret')
  .update(JSON.stringify(payload))
  .digest('hex');

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(() => {
    process.env.WEBHOOK_DATA_FILE = join(tmpdir(), `webhooks-${randomUUID()}.json`);
    service = new WebhookService(new WebhookStore());
  });

  it('accepts a signed webhook and rejects duplicate event IDs', () => {
    const request = {
      eventId: 'evt-101',
      eventType: 'order.paid',
      destinationUrl: 'http://localhost:4000/webhooks',
      payload,
    };

    expect(service.receive(request, signature).status).toBe('PENDING');
    expect(() => service.receive(request, signature)).toThrow(ConflictException);
  });

  it('retries temporary failures and dead-letters permanent failures', () => {
    const event = service.receive({
      eventId: 'evt-102',
      eventType: 'order.paid',
      destinationUrl: 'http://localhost:4000/webhooks',
      payload,
    }, signature);

    expect(service.recordDelivery(event.id, 503).status).toBe('RETRYING');
    expect(service.recordDelivery(event.id, 400).status).toBe('DEAD_LETTER');
  });
});
