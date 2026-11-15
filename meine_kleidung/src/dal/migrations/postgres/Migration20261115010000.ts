import { Migration } from '@mikro-orm/migrations';

export class Migration20261115010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "garment" add column "material" text null, add column "article_number" varchar(255) null;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table "garment" drop column "material", drop column "article_number";');
  }
}
