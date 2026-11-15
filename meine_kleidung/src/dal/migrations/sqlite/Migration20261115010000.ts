import { Migration } from '@mikro-orm/migrations';

export class Migration20261115010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table `garment` add column `material` text null;');
    this.addSql('alter table `garment` add column `article_number` text null;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table `garment` drop column `material`;');
    this.addSql('alter table `garment` drop column `article_number`;');
  }
}
