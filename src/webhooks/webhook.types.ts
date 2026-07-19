export type WebhookStatus = 'PENDING' | 'DELIVERED' | 'RETRYING' | 'DEAD_LETTER';

export interface DeliveryAttempt {
  attempt: number;
  statusCode?: number;
  error?: string;
  attemptedAt: string;
  nextRetryAt?: string;
}

export interface WebhookEvent {
  id: string;
  eventId: string;
  eventType: string;
  destinationUrl: string;
  payload: Record<string, unknown>;
  status: WebhookStatus;
  receivedAt: string;
  attempts: DeliveryAttempt[];
}
