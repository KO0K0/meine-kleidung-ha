import { MultipartFile } from '@fastify/multipart';

export interface UpdateGarmentDto {
  name?: string;
  category?: string;
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
