import { MikroORM } from '@mikro-orm/core';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Joi from 'joi';
import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { File } from '../dal/entity/file.entity';
import { Garment } from '../dal/entity/garment.entity';
import { Inventory } from '../dal/entity/inventory.entity';
import { FileService } from '../file/file-service.abstract';
import {
  applyInventoryAction,
  initialInventory,
  InventoryData,
  stockFor,
} from './inventory.logic';
import { InventoryService } from './inventory.service';

export const backupLimit = 100 * 1024 * 1024;
const placeId = Joi.string().pattern(/^[a-z0-9-]{1,60}$/i);
const optionalText = Joi.string().allow('').max(10000);
const image = Joi.string()
  .base64()
  .max(20 * 1024 * 1024);
const backupSchema = Joi.object({
  version: Joi.valid(1).required(),
  preferences: Joi.object({
    hiddenColors: Joi.array()
      .items(Joi.string().min(1).max(60))
      .max(100)
      .required(),
    customColors: Joi.array()
      .items(Joi.string().min(1).max(60))
      .max(100)
      .required(),
    routes: Joi.array()
      .items(
        Joi.object({
          source: placeId.required(),
          destination: placeId.required(),
        }),
      )
      .max(20)
      .required(),
  }).optional(),
  locations: Joi.array()
    .items(
      Joi.object({
        id: placeId.required(),
        name: Joi.string().trim().min(1).max(60).required(),
      }),
    )
    .min(4)
    .max(30)
    .unique('id')
    .required(),
  garments: Joi.array()
    .items(
      Joi.object({
        category: Joi.string().min(1).max(255).required(),
        name: optionalText,
        brand: optionalText,
        size: optionalText,
        color: optionalText,
        notes: optionalText,
        washingDetails: optionalText,
        dateAquired: Joi.string().isoDate(),
        archived: Joi.boolean().required(),
        photo: Joi.object({
          original: image.required(),
          cutout: image,
        }).optional(),
        bins: Joi.array()
          .items(
            Joi.object({
              location: placeId.required(),
              status: Joi.valid('available', 'laundry').required(),
              quantity: Joi.number().integer().min(1).max(10000).required(),
            }),
          )
          .max(60)
          .required(),
      }),
    )
    .max(10000)
    .required(),
});

interface Backup {
  version: 1;
  preferences?: InventoryData['preferences'];
  locations: InventoryData['locations'];
  garments: (Pick<
    Garment,
    | 'category'
    | 'name'
    | 'brand'
    | 'size'
    | 'color'
    | 'notes'
    | 'washingDetails'
    | 'archived'
  > & {
    dateAquired?: string;
    photo?: { original: string; cutout?: string };
    bins: InventoryData['stock'][string];
  })[];
}

@Injectable()
export class InventoryBackupService {
  constructor(
    private readonly orm: MikroORM,
    private readonly config: ConfigService,
    private readonly inventory: InventoryService,
    private readonly files: FileService,
  ) {}

  private directory(): string {
    if (this.config.get('FILE_STORAGE_TYPE', 'local') !== 'local')
      throw new BadRequestException(
        'Sicherungen sind für lokalen Fotospeicher verfügbar.',
      );
    return this.config.getOrThrow<string>('DATA_PATH');
  }

  async export(userId?: number): Promise<string> {
    const directory = this.directory();
    await this.inventory.snapshot(userId);
    const em = this.orm.em.fork();
    const ledger = await em.findOneOrFail(Inventory, { ownerKey: userId ?? 0 });
    const garments = await em.find(
      Garment,
      { owner: userId ?? null },
      { populate: ['photo'], orderBy: { id: 'asc' } },
    );
    const backup: Backup = {
      version: 1,
      preferences: ledger.data.preferences,
      locations: ledger.data.locations,
      garments: [],
    };
    let photoBytes = 0;
    const encode = async (fileName: string) => {
      const buffer = await readFile(join(directory, fileName));
      photoBytes += buffer.byteLength;
      if (photoBytes > backupLimit * 0.75)
        throw new BadRequestException('Die Sicherung ist größer als 100 MB.');
      return buffer.toString('base64');
    };
    for (const garment of garments) {
      const {
        name,
        category,
        brand,
        size,
        color,
        notes,
        washingDetails,
        archived,
        dateAquired,
      } = garment;
      const photo = garment.photo
        ? {
            original: await encode(garment.photo.fileName),
            cutout: await encode(
              this.files.nobgFileName(garment.photo.fileName),
            ).catch((error) => {
              if (error.code === 'ENOENT') return undefined;
              throw error;
            }),
          }
        : undefined;
      backup.garments.push({
        name: name ?? undefined,
        category,
        brand: brand ?? undefined,
        size: size ?? undefined,
        color: color ?? undefined,
        notes: notes ?? undefined,
        washingDetails: washingDetails ?? undefined,
        archived,
        dateAquired: dateAquired?.toISOString(),
        photo,
        bins: stockFor(ledger.data, garment.id),
      });
    }
    const json = JSON.stringify(backup);
    if (Buffer.byteLength(json) > backupLimit)
      throw new BadRequestException('Die Sicherung ist größer als 100 MB.');
    return json;
  }

  async import(buffer: Buffer, userId?: number) {
    const directory = this.directory();
    let json: unknown;
    try {
      json = JSON.parse(buffer.toString('utf8'));
    } catch {
      throw new BadRequestException('Die Datei ist keine gültige Sicherung.');
    }
    const validated = backupSchema.validate(json, { convert: false });
    if (validated.error)
      throw new BadRequestException(
        'Die Sicherungsdatei enthält ungültige Daten.',
      );
    const backup = validated.value as Backup;
    const required = initialInventory().locations;
    if (
      !required.every(({ id }) =>
        backup.locations.some((place) => place.id === id),
      )
    )
      throw new BadRequestException('In der Sicherung fehlen Standardorte.');
    const data: InventoryData = { locations: backup.locations, stock: {} };
    if (backup.preferences)
      data.preferences = applyInventoryAction(
        data,
        { type: 'preferences', revision: 0, preferences: backup.preferences },
        new Set(),
        '',
      ).preferences;
    const indices = new Set(backup.garments.map((_, index) => index));
    const allocations = backup.garments.map(
      ({ bins }, index) =>
        applyInventoryAction(
          data,
          { revision: 0, type: 'stock', garmentId: index, bins },
          indices,
          '',
        ).stock[index],
    );
    await this.inventory.snapshot(userId);
    const written: string[] = [];
    const savePhoto = async (encoded: string, fileName: string) => {
      const bytes = Buffer.from(encoded, 'base64');
      const metadata = await sharp(bytes)
        .metadata()
        .catch(() => undefined);
      if (
        metadata?.format !== 'webp' ||
        metadata.width > 4096 ||
        metadata.height > 4096
      )
        throw new BadRequestException(
          'Ein Foto in der Sicherung ist ungültig.',
        );
      const target = join(directory, fileName);
      // UUID filenames are generated here and never taken from the upload.
      await writeFile(target, bytes, { flag: 'wx' });
      written.push(target);
    };
    try {
      return await this.orm.em.fork().transactional(async (em) => {
        const ownerKey = userId ?? 0;
        const ledger = await em.findOneOrFail(Inventory, { ownerKey });
        const claimed = await em.nativeUpdate(
          Inventory,
          { ownerKey, revision: ledger.revision },
          { revision: ledger.revision + 1 },
        );
        if (
          claimed !== 1 ||
          (await em.count(Garment, { owner: userId ?? null }))
        )
          throw new ConflictException(
            'Ein Import ist nur in einen leeren Bestand möglich.',
          );
        const imported: Garment[] = [];
        for (const {
          photo,
          dateAquired,
          bins: _bins,
          ...fields
        } of backup.garments) {
          let file: File | undefined;
          if (photo) {
            const fileName = randomUUID() + '.webp';
            await savePhoto(photo.original, fileName);
            if (photo.cutout)
              await savePhoto(photo.cutout, this.files.nobgFileName(fileName));
            file = em.create(File, {
              fileName,
              mimetype: 'image/webp',
              createdOn: new Date().toISOString(),
              createdBy: userId,
            });
          }
          const garment = em.create(Garment, {
            ...fields,
            owner: userId,
            photo: file,
            dateAquired: dateAquired ? new Date(dateAquired) : undefined,
          });
          em.persist(garment);
          imported.push(garment);
        }
        await em.flush();
        imported.forEach(({ id }, index) => {
          data.stock[id] = allocations[index];
        });
        await em.nativeUpdate(Inventory, { ownerKey }, { data });
        return { imported: imported.length };
      });
    } catch (error) {
      await Promise.allSettled(written.map((file) => unlink(file)));
      throw error;
    }
  }
}
