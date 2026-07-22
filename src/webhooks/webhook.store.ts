import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { WebhookEvent } from './webhook.types';

@Injectable()
export class WebhookStore {
  private readonly filePath = resolve(process.env.WEBHOOK_DATA_FILE ?? 'data/webhooks.json');
  private readonly events = new Map<string, WebhookEvent>();

  constructor() {
    this.load();
  }

  save(event: WebhookEvent): WebhookEvent {
    this.events.set(event.id, event);
    this.flush();
    return event;
  }

  findById(id: string): WebhookEvent | undefined {
    return this.events.get(id);
  }

  findByEventId(eventId: string): WebhookEvent | undefined {
    return [...this.events.values()].find((event) => event.eventId === eventId);
  }

  findReadyForDelivery(now = new Date()): WebhookEvent[] {
    return [...this.events.values()].filter((event) => {
      if (event.status === 'PENDING') return true;
      if (event.status !== 'RETRYING') return false;
      const nextRetryAt = event.attempts.at(-1)?.nextRetryAt;
      return Boolean(nextRetryAt && new Date(nextRetryAt) <= now);
    });
  }

  private load(): void {
    if (!existsSync(this.filePath)) return;
    const content = readFileSync(this.filePath, 'utf8').trim();
    if (!content) return;
    const events = JSON.parse(content) as WebhookEvent[];
    events.forEach((event) => this.events.set(event.id, event));
  }

  private flush(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify([...this.events.values()], null, 2));
  }
}
