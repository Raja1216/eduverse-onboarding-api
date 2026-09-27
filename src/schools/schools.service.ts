import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const schools = await this.prisma.institution.findMany({
      where: { status: true },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      status: true,
      message: 'Schools fetched successfully',
      data: schools,
    };
  }
}
