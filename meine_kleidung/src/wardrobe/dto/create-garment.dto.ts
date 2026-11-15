import { MultipartFile } from '@fastify/multipart';
export interface CreateGarmentDto {
  initialLocation?: string;
  initialQuantity?: number;
  captureToken?: string;
  name?: string;
  category: string;
  brand?: string;
  color?: string;
  size?: string;
  material?: string;
  articleNumber?: string;
  notes?: string;
  washingDetails?: string;
  dateAquired?: string;
  files?: AsyncIterableIterator<MultipartFile>;
}
