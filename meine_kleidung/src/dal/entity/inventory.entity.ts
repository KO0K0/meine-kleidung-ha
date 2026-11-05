import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import type { InventoryData } from '../../wardrobe/inventory.logic';

@Entity()
export class Inventory {
  // Zero is the existing single-user mode without accounts.
  @PrimaryKey({ autoincrement: false })
  ownerKey!: number;

  @Property()
  revision = 0;

  @Property({ type: 'json' })
  data!: InventoryData;
}
