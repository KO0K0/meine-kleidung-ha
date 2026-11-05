import { Migration } from '@mikro-orm/migrations';

export class Migration20261105010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql('create table "inventory" ("owner_key" integer not null primary key, "revision" integer not null default 0, "data" jsonb not null);');
  }
}
