import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}
  find(clerkId: string) {
    return this.prisma.user.findUnique({ where: { clerkId } });
  }
  delete(clerkId: string) {
    return this.prisma.user.deleteMany({ where: { clerkId } });
  }
  upsert(
    clerkId: string,
    profile: { email: string | null; name: string | null },
  ) {
    return this.prisma.user.upsert({
      where: { clerkId },
      update: { clerkId },
      create: { clerkId, ...profile },
    });
  }
}
