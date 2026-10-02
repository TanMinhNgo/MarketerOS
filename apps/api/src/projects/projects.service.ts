import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateProjectInput,
  ProjectListQuery,
  UpdateProjectInput,
  PlanKey,
} from '@marketos/shared';
import { Prisma } from '../generated/prisma/client';
import { ProjectsRepository } from './projects.repository';

@Injectable()
export class ProjectsService {
  constructor(private readonly projects: ProjectsRepository) {}
  list(ownerId: string, query: ProjectListQuery, trash = false) {
    return this.projects.list(ownerId, query, trash);
  }
  get(id: string, ownerId: string) {
    return this.projects.owned(id, ownerId);
  }
  create(ownerId: string, data: CreateProjectInput, plan: PlanKey) {
    return this.projects.create(ownerId, data, plan);
  }
  update(id: string, ownerId: string, data: UpdateProjectInput) {
    return this.write(() => this.projects.update(id, ownerId, data));
  }
  trash(id: string, ownerId: string) {
    return this.write(() => this.projects.trash(id, ownerId));
  }
  restore(id: string, ownerId: string, plan: PlanKey) {
    return this.write(() => this.projects.restore(id, ownerId, plan));
  }
  private async write<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      )
        throw new NotFoundException();
      throw error;
    }
  }
}
