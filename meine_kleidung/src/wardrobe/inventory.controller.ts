import {
  Body,
  Controller,
  Get,
  Post,
  Render,
  Req,
  Res,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ConditionalAuthGuard } from '../auth/conditional-auth.guard';
import { InventoryService } from './inventory.service';
import type { InventoryAction } from './inventory.logic';
import {
  backupLimit,
  InventoryBackupService,
} from './inventory-backup.service';

@Controller('inventory')
@UseGuards(ConditionalAuthGuard)
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly backups: InventoryBackupService,
  ) {}

  private userId(req: FastifyRequest): number | undefined {
    return (req as FastifyRequest & { user?: { userId: number } }).user?.userId;
  }

  @Get()
  @Render('inventory/index')
  index() {
    return { pageTitle: 'Meine Kleidung' };
  }

  @Get('data')
  async data(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    reply.header('Cache-Control', 'no-store');
    return this.inventory.snapshot(this.userId(req));
  }

  @Post('actions')
  action(@Req() req: FastifyRequest, @Body() body: InventoryAction) {
    // Custom header + JSON prevents cross-site HTML form submissions.
    if (
      req.headers['x-inventory-request'] !== '1' ||
      !req.headers['content-type']?.startsWith('application/json')
    )
      throw new ForbiddenException();
    return this.inventory.change(body, this.userId(req));
  }

  @Get('backup')
  async backup(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const contents = await this.backups.export(this.userId(req));
    return reply
      .header('Cache-Control', 'no-store')
      .header(
        'Content-Disposition',
        'attachment; filename="meine-kleidung-sicherung.json"',
      )
      .type('application/json')
      .send(contents);
  }

  @Post('backup')
  async importBackup(@Req() req: FastifyRequest) {
    if (req.headers['x-inventory-request'] !== '1')
      throw new ForbiddenException();
    if (!req.isMultipart())
      throw new BadRequestException('Wähle eine Sicherungsdatei aus.');
    const file = await req.file({
      limits: { files: 1, fileSize: backupLimit },
    });
    if (!file) throw new BadRequestException('Wähle eine Sicherungsdatei aus.');
    return this.backups.import(await file.toBuffer(), this.userId(req));
  }
}
