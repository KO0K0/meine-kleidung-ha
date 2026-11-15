import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Render,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { I18n, I18nContext } from 'nestjs-i18n';
import { ConditionalAuthGuard } from '../auth/conditional-auth.guard';
import { Payload } from '../auth/dto/payload.dto';
import { GarmentCategory } from './garment-category.enum';
import { GarmentColor } from './garment-color.enum';
import { GarmentService } from './garment.service';
import { WardrobeShareService } from '../wardrobe-share/wardrobe-share.service';
import { SharePermission } from '../dal/entity/wardrobe-share.entity';
import type { SearchGarmentDto } from './dto/search-garment.dto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { Readable } from 'node:stream';

@UseGuards(ConditionalAuthGuard)
@Controller('wardrobe')
export class WardrobeController {
  private readonly logger = new Logger(WardrobeController.name);

  constructor(
    private readonly garmentService: GarmentService,
    private readonly shareService: WardrobeShareService,
  ) {}

  private userId(req: any): number | undefined {
    return (req['user'] as Payload | undefined)?.userId;
  }

  @Get()
  @Render('wardrobe/index')
  async index(
    @Req() req: FastifyRequest,
    @Query() query: SearchGarmentDto,
    @Query('ownerId') ownerId: string | undefined,
    @I18n() i18n: I18nContext,
  ) {
    const userId = this.userId(req);
    let viewOwner: number | undefined;
    let sharedWardrobes: any[] = [];
    let canEdit = true;

    if (userId != null) {
      sharedWardrobes = await this.shareService.getInboundShares(userId);
      sharedWardrobes = sharedWardrobes.map((s) => ({
        id: s.id,
        grantorId: s.grantor.unwrap().id,
        grantorName: s.grantor.unwrap().firstName || s.grantor.unwrap().email,
        permission: s.permission,
      }));
    }

    if (ownerId && userId != null) {
      viewOwner = parseInt(ownerId, 10);
      if (viewOwner === userId) {
        viewOwner = undefined;
      } else {
        const canView = await this.shareService.canView(userId, viewOwner);
        if (!canView) throw new ForbiddenException();
        const perm = await this.shareService.getSharePermission(
          userId,
          viewOwner,
        );
        canEdit = perm === SharePermission.MANAGE;
      }
    }

    const [garments, filters] = await Promise.all([
      this.garmentService.findAll(userId, query, viewOwner),
      this.garmentService.findAvailableFilters(viewOwner ?? userId),
    ]);
    const availableCategories = filters.categories.map((value) => ({
      value,
      label: this.garmentService.resolveCategoryLabel(value, i18n),
    }));
    return {
      garments,
      availableCategories,
      colors: Object.values(GarmentColor),
      availableSizes: filters.sizes,
      search: query,
      sharedWardrobes,
      viewOwner: viewOwner ?? null,
      canEdit,
    };
  }

  @Get('new')
  @Render('wardrobe/form')
  async newForm(
    @Req() req: FastifyRequest,
    @I18n() i18n: I18nContext,
    @Query('ownerId') ownerId: string | undefined,
  ) {
    const userId = this.userId(req);
    const viewOwner = ownerId ? parseInt(ownerId, 10) : undefined;
    if (userId != null && viewOwner != null && viewOwner !== userId) {
      const canManage = await this.shareService.canManage(userId, viewOwner);
      if (!canManage) throw new ForbiddenException();
    }
    const filters = await this.garmentService.findAvailableFilters(
      viewOwner ?? userId,
    );
    const enumValues = Object.values(GarmentCategory) as string[];
    const customCategories = filters.categories.filter(
      (c) => !enumValues.includes(c),
    );
    const categories = [...enumValues, ...customCategories].map((value) => ({
      value,
      label: this.garmentService.resolveCategoryLabel(value, i18n),
    }));
    return {
      categories,
      colors: Object.values(GarmentColor),
      garment: null,
      knownBrands: filters.brands,
      viewOwner,
    };
  }

  @Post()
  async create(
    @Body()
    body: {
      name?: string;
      category: string;
      brand?: string;
      color?: string | string[];
      size?: string;
      material?: string;
      articleNumber?: string;
      notes?: string;
      washingDetails?: string;
      dateAquired?: string;
      initialLocation?: string;
      initialQuantity?: string;
      captureToken?: string;
    },
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query('ownerId') ownerId: string | undefined,
  ) {
    const userId = this.userId(req);
    const viewOwner = ownerId ? parseInt(ownerId, 10) : undefined;

    if (userId != null && viewOwner != null && viewOwner !== userId) {
      const canManage = await this.shareService.canManage(userId, viewOwner);
      if (!canManage) throw new ForbiddenException();
    }

    // Fastify gives string if one checkbox, string[] if multiple — normalise both
    // Read all fields before creating anything. Multipart fields may follow files.
    const photos: MultipartFile[] = [];
    if (req.isMultipart()) {
      body = { category: '' };
      const fields = new Set(['name', 'category', 'brand', 'color', 'size', 'material', 'articleNumber', 'notes', 'washingDetails', 'dateAquired', 'initialLocation', 'initialQuantity', 'captureToken']);
      for await (const part of req.parts({ limits: { files: 2, fields: 40, parts: 42, fileSize: 20 * 1024 * 1024 } })) {
        if (part.type === 'file') {
          const bytes = await part.toBuffer();
          if (!bytes.length) continue;
          if (!['photo', 'nobgPhoto'].includes(part.fieldname) ||
              !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(part.mimetype) ||
              photos.some(photo => photo.fieldname === part.fieldname)) {
            throw new BadRequestException('Bitte ein gültiges Kleidungsfoto auswählen.');
          }
          photos.push({ ...part, file: Readable.from(bytes) } as MultipartFile);
        } else if (fields.has(part.fieldname)) {
          const value = String(part.value);
          if (part.fieldname === 'color') {
            const previous = body.color;
            body.color = previous ? [...(Array.isArray(previous) ? previous : [previous]), value] : [value];
          } else {
            body[part.fieldname] = value;
          }
        }
      }
    }
    if (!body?.category?.trim()) {
      throw new BadRequestException('Bitte eine Kategorie angeben.');
    }
    if (photos.some(photo => photo.fieldname === 'nobgPhoto') && !photos.some(photo => photo.fieldname === 'photo')) {
      throw new BadRequestException('Das Originalfoto fehlt.');
    }
    const rawColors = Array.isArray(body.color)
      ? body.color
      : (body.color
          ?.split(',')
          .map((c) => c.trim())
          .filter(Boolean) ?? []);

    const capture = body.initialLocation !== undefined || body.captureToken !== undefined;
    const quantity = Number(body.initialQuantity ?? 1);
    if (capture && (!body.initialLocation || !/^[a-z0-9-]{1,60}$/i.test(body.initialLocation) ||
        !/^[a-f0-9-]{36}$/i.test(body.captureToken ?? '') || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000)) {
      throw new BadRequestException('Bitte Ort und eine ganze Menge zwischen 1 und 10000 angeben.');
    }

    const garment = await this.garmentService.create(
      {
        name: body.name,
        initialLocation: capture ? body.initialLocation : undefined,
        initialQuantity: capture ? quantity : undefined,
        captureToken: capture ? body.captureToken : undefined,
        category: body.category,
        brand: body.brand,
        color: rawColors.join(','),
        size: body.size,
        material: body.material,
        articleNumber: body.articleNumber,
        notes: body.notes,
        washingDetails: body.washingDetails,
        dateAquired: body.dateAquired,
        files: photos.length ? (async function* () { yield* photos; })() : undefined,
      },
      viewOwner ?? userId,
    );

    const params = new URLSearchParams({ created: '1' });
    if (viewOwner) params.set('ownerId', String(viewOwner));
    return reply.redirect(`/wardrobe/${garment.id}?${params}`, 302);
  }

  @Get(':id')
  @Render('wardrobe/show')
  async show(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FastifyRequest,
    @I18n() i18n: I18nContext,
    @Query('ownerId') ownerId: string | undefined,
    @Query('created') created: string | undefined,
    @Query('photoSaved') photoSaved: string | undefined,
  ) {
    const userId = this.userId(req);
    const viewOwner = ownerId ? parseInt(ownerId, 10) : undefined;
    const garment = await this.garmentService.findOne(id, userId, viewOwner);

    let canEdit = true;
    let canDelete = true;
    let canClone = true;
    if (userId != null && viewOwner != null && viewOwner !== userId) {
      const perm = await this.shareService.getSharePermission(
        userId,
        viewOwner,
      );
      canEdit = perm === SharePermission.MANAGE;
      canClone = perm === SharePermission.MANAGE;
      canDelete = false;
    } else if (userId != null && garment.owner?.id !== userId) {
      canEdit = false;
      canDelete = false;
      canClone = false;
    }

    return {
      garment,
      categoryLabel: this.garmentService.resolveCategoryLabel(
        garment.category,
        i18n,
      ),
      canEdit,
      canDelete,
      canClone,
      viewOwner: viewOwner ?? null,
      justCreated: created === '1',
      justSavedPhoto: photoSaved === '1',
    };
  }

  @Get(':id/edit')
  @Render('wardrobe/form')
  async editForm(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FastifyRequest,
    @I18n() i18n: I18nContext,
    @Query('ownerId') ownerId: string | undefined,
  ) {
    const userId = this.userId(req);
    const viewOwner = ownerId ? parseInt(ownerId, 10) : undefined;

    if (userId != null && viewOwner != null && viewOwner !== userId) {
      const canManage = await this.shareService.canManage(userId, viewOwner);
      if (!canManage) throw new ForbiddenException();
    }

    const [garment, filters] = await Promise.all([
      this.garmentService.findOne(id, userId, viewOwner),
      this.garmentService.findAvailableFilters(viewOwner ?? userId),
    ]);
    const enumValues = Object.values(GarmentCategory) as string[];
    const customCategories = filters.categories.filter(
      (c) => !enumValues.includes(c),
    );
    const categories = [...enumValues, ...customCategories].map((value) => ({
      value,
      label: this.garmentService.resolveCategoryLabel(value, i18n),
    }));
    const colorEnumValues = Object.values(GarmentColor) as string[];
    const savedColors =
      garment.color
        ?.split(',')
        .map((c) => c.trim())
        .filter(Boolean) ?? [];
    const customColors = savedColors.filter(
      (c) => !colorEnumValues.includes(c),
    );

    return {
      garment,
      categories,
      knownBrands: filters.brands,
      colors: colorEnumValues,
      customColors,
      viewOwner: viewOwner ?? null,
    };
  }

  @Get(':id/clone')
  @Render('wardrobe/form')
  async cloneForm(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FastifyRequest,
    @I18n() i18n: I18nContext,
    @Query('ownerId') ownerId: string | undefined,
  ) {
    const userId = this.userId(req);
    const viewOwner = ownerId ? parseInt(ownerId, 10) : undefined;
    const [garment, filters] = await Promise.all([
      this.garmentService.findOne(id, userId, viewOwner),
      this.garmentService.findAvailableFilters(viewOwner ?? userId),
    ]);
    const enumValues = Object.values(GarmentCategory) as string[];
    const customCategories = filters.categories.filter(
      (c) => !enumValues.includes(c),
    );
    const categories = [...enumValues, ...customCategories].map((value) => ({
      value,
      label: this.garmentService.resolveCategoryLabel(value, i18n),
    }));
    return {
      garment,
      isClone: true,
      knownBrands: filters.brands,
      cloneName: garment.name ? `${garment.name} (cloned)` : undefined,
      categories,
      colors: Object.values(GarmentColor),
      viewOwner: viewOwner ?? null,
    };
  }

  @Post(':id/clone')
  async cloneCreate(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      name?: string;
      category: string;
      brand?: string;
      color?: GarmentColor;
      size?: string;
      material?: string;
      articleNumber?: string;
      notes?: string;
    },
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query('ownerId') ownerId: string | undefined,
  ) {
    const userId = this.userId(req);
    const viewOwner = ownerId ? parseInt(ownerId, 10) : undefined;
    // Verify the requesting user has access to the source garment
    await this.garmentService.findOne(id, userId, viewOwner);
    const cloned = await this.garmentService.clone(
      id,
      {
        name: body.name,
        category: body.category,
        brand: body.brand,
        color: Array.isArray(body.color) ? body.color.join(',') : body.color,
        size: body.size,
        material: body.material,
        articleNumber: body.articleNumber,
        notes: body.notes,
      },
      userId,
    );
    return reply.redirect(`/wardrobe/${cloned.id}`, 302);
  }

  @Post(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      name?: string;
      category?: string;
      brand?: string;
      color?: GarmentColor;
      size?: string;
      material?: string;
      articleNumber?: string;
      notes?: string;
      washingDetails?: string;
      dateAquired?: string;
    },
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query('ownerId') ownerId: string | undefined,
  ) {
    const userId = this.userId(req);
    const viewOwner = ownerId ? parseInt(ownerId, 10) : undefined;

    if (userId != null && viewOwner != null && viewOwner !== userId) {
      const canManage = await this.shareService.canManage(userId, viewOwner);
      if (!canManage) throw new ForbiddenException();
    }

    await this.garmentService.update(
      id,
      {
        name: body.name,
        category: body.category,
        brand: body.brand,
        color: Array.isArray(body.color) ? body.color.join(',') : body.color,
        size: body.size,
        material: body.material,
        articleNumber: body.articleNumber,
        notes: body.notes,
        washingDetails: body.washingDetails,
        dateAquired: body.dateAquired,
      },
      viewOwner ?? userId,
      userId,
    );
    const redirectSuffix = viewOwner ? `?ownerId=${viewOwner}` : '';
    return reply.redirect(`/wardrobe/${id}${redirectSuffix}`, 302);
  }

  @Post(':id/photo')
  async uploadPhoto(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query('ownerId') ownerId: string | undefined,
  ) {
    const userId = this.userId(req);
    const viewOwner = ownerId ? parseInt(ownerId, 10) : undefined;

    if (userId != null && viewOwner != null && viewOwner !== userId) {
      const canManage = await this.shareService.canManage(userId, viewOwner);
      if (!canManage) throw new ForbiddenException();
    }

    await this.garmentService.update(
      id,
      { files: req.files({ limits: { files: 2 } }) },
      viewOwner ?? userId,
      userId,
    );
    const params = new URLSearchParams({ photoSaved: '1' });
    if (viewOwner) params.set('ownerId', String(viewOwner));
    reply.header('HX-Redirect', `/wardrobe/${id}?${params}`);
    return reply.send();
  }

  @Post(':id/archive')
  async archive(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query('ownerId') ownerId: string | undefined,
  ) {
    const userId = this.userId(req);
    const viewOwner = ownerId ? parseInt(ownerId, 10) : undefined;

    // Archive/unarchive is only allowed for the owner
    if (viewOwner != null && viewOwner !== userId) {
      throw new ForbiddenException();
    }

    await this.garmentService.archive(id, userId);
    const redirectSuffix = viewOwner ? `?ownerId=${viewOwner}` : '';
    reply.header('HX-Redirect', `/wardrobe/${id}${redirectSuffix}`);
    return reply.send();
  }

  @Post(':id/nobg')
  async updateNobg(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query('ownerId') ownerId: string | undefined,
  ) {
    const userId = this.userId(req);
    const viewOwner = ownerId ? parseInt(ownerId, 10) : undefined;

    if (userId != null && viewOwner != null && viewOwner !== userId) {
      const canManage = await this.shareService.canManage(userId, viewOwner);
      if (!canManage) throw new ForbiddenException();
    }

    const nobgPhoto = await req.file();
    await this.garmentService.updateNobg(
      id,
      nobgPhoto,
      viewOwner ?? userId,
      userId,
    );
    const redirectSuffix = viewOwner ? `?ownerId=${viewOwner}` : '';
    reply.header('HX-Redirect', `/wardrobe/${id}${redirectSuffix}`);
    return reply.send();
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query('ownerId') ownerId: string | undefined,
  ) {
    const userId = this.userId(req);
    const viewOwner = ownerId ? parseInt(ownerId, 10) : undefined;

    // Delete is only allowed for the owner
    if (viewOwner != null && viewOwner !== userId) {
      throw new ForbiddenException();
    }

    await this.garmentService.remove(id, userId);
    reply.header('HX-Redirect', '/inventory');
    return reply.send();
  }
}
