import { MikroORM } from '@mikro-orm/core';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Inventory } from '../dal/entity/inventory.entity';
import { GarmentService } from './garment.service';
import {
  applyInventoryAction,
  initialInventory,
  InventoryAction,
  stockFor,
} from './inventory.logic';

@Injectable()
export class InventoryService {
  constructor(
    private readonly orm: MikroORM,
    private readonly garments: GarmentService,
  ) {}

  private async ledger(userId?: number) {
    const em = this.orm.em.fork();
    // Conflict-ignore makes first access from two devices safe.
    await em.upsert(
      Inventory,
      { ownerKey: userId ?? 0, revision: 0, data: initialInventory() },
      { onConflictAction: 'ignore', onConflictFields: ['ownerKey'] },
    );
    em.clear();
    return em.findOneOrFail(Inventory, { ownerKey: userId ?? 0 });
  }

  async snapshot(userId?: number) {
    const [ledger, garments] = await Promise.all([
      this.ledger(userId),
      this.garments.findAll(userId),
    ]);
    return {
      revision: ledger.revision,
      locations: ledger.data.locations,
      preferences: ledger.data.preferences ?? {
        hiddenColors: [],
        customColors: [],
        routes: [],
      },
      garments: garments.map((garment) => ({
        id: garment.id,
        name: garment.name ?? '',
        category: garment.category,
        brand: garment.brand ?? '',
        size: garment.size ?? '',
        color: garment.color ?? '',
        notes: garment.notes ?? '',
        photo: garment.photo?.fileName ?? null,
        bins: stockFor(ledger.data, garment.id),
      })),
    };
  }

  async change(action: InventoryAction, userId?: number) {
    if (
      !action ||
      !Number.isSafeInteger(action.revision) ||
      action.revision < 0
    )
      throw new BadRequestException('Ungültiger Bearbeitungsstand.');
    const [ledger, garments] = await Promise.all([
      this.ledger(userId),
      this.garments.findAll(userId),
    ]);
    const conflict = () =>
      new ConflictException(
        'Der Bestand wurde inzwischen geändert. Bitte aktualisieren und erneut auswählen.',
      );
    if (ledger.revision !== action.revision) throw conflict();
    const data = applyInventoryAction(
      ledger.data,
      action,
      new Set(garments.map((garment) => garment.id)),
      randomUUID(),
    );
    // One atomic compare-and-swap persists the entire batch. Retries with the
    // old revision are rejected, even if the previous response was lost.
    const changed = await this.orm.em
      .fork()
      .nativeUpdate(
        Inventory,
        { ownerKey: userId ?? 0, revision: action.revision },
        { data, revision: action.revision + 1 },
      );
    if (changed !== 1) throw conflict();
    return { revision: action.revision + 1 };
  }
}
