import { Injectable } from '@nestjs/common';
import type {
  ContentListQuery,
  CreateContentInput,
  UpdateContentInput,
} from '@marketos/shared';
import { ContentRepository } from './content.repository';

@Injectable()
export class ContentService {
  constructor(private readonly contents: ContentRepository) {}

  list(projectId: string, ownerId: string, query: ContentListQuery) {
    return this.contents.list(projectId, ownerId, query);
  }
  get(projectId: string, ownerId: string, id: string) {
    return this.contents.get(projectId, ownerId, id);
  }
  create(projectId: string, ownerId: string, data: CreateContentInput) {
    return this.contents.create(projectId, ownerId, data);
  }
  update(
    projectId: string,
    ownerId: string,
    id: string,
    data: UpdateContentInput,
  ) {
    return this.contents.update(projectId, ownerId, id, data);
  }
  delete(projectId: string, ownerId: string, id: string) {
    return this.contents.delete(projectId, ownerId, id);
  }
}
