import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { ReceiveWebhookDto } from './webhook.dto';
import { WebhookService } from './webhook.service';

@ApiTags('webhooks')
@Controller('api/v1/webhooks')
export class WebhookController {
  constructor(private readonly service: WebhookService) {}

  @Post()
  @ApiHeader({ name: 'x-webhook-signature', required: true })
  receive(
    @Body() dto: ReceiveWebhookDto,
    @Headers('x-webhook-signature') signature?: string,
  ) {
    return this.service.receive(dto, signature);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post(':id/attempts')
  recordAttempt(
    @Param('id') id: string,
    @Body() body: { statusCode: number; error?: string },
  ) {
    return this.service.recordDelivery(id, body.statusCode, body.error);
  }

  @Post(':id/replay')
  replay(@Param('id') id: string) {
    return this.service.replay(id);
  }
}
