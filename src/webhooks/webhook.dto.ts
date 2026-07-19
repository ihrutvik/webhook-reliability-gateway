import { IsObject, IsString, IsUrl } from 'class-validator';

export class ReceiveWebhookDto {
  @IsString()
  eventId!: string;

  @IsString()
  eventType!: string;

  @IsUrl({ require_tld: false })
  destinationUrl!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
