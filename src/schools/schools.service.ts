
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Get all available boards
  async getBoards() {
    const rows = await this.prisma.eventSchools.findMany({
      where: {
        status: true,
        board: { not: null },
      },
      distinct: ['board'],
      select: { board: true },
    });

    const boards = [...new Set(
      rows.map(r => r.board?.trim()).filter(
        (value): value is string => Boolean(value),
      ),
    )].sort((a, b) => a.localeCompare(b));

    return {
      status: true,
      message: 'Boards fetched successfully',
      data: boards,
    };
  }

  // 2. Get states based on board
  async getStates(board: string) {
    const rows = await this.prisma.eventSchools.findMany({
      where: {
        status: true,
        board,
        state: { not: null },
      },
      distinct: ['state'],
      select: { state: true },
    });

    const states = [...new Set(
      rows.map(r => r.state?.trim()).filter(
        (value): value is string => Boolean(value),
      ),
    )].sort((a, b) => a.localeCompare(b));

    return {
      status: true,
      message: 'States fetched successfully',
      data: states,
    };
  }

  // 3. Get districts based on board and state
  async getDistricts(board: string, state: string) {
    const rows = await this.prisma.eventSchools.findMany({
      where: {
        status: true,
        board,
        state,
        district: { not: null },
      },
      distinct: ['district'],
      select: { district: true },
    });

    const districts = [...new Set(
      rows.map(r => r.district?.trim()).filter(
        (value): value is string => Boolean(value),
      ),
    )].sort((a, b) => a.localeCompare(b));

    return {
      status: true,
      message: 'Districts fetched successfully',
      data: districts,
    };
  }

  // 4. Filter schools
  async list(board?: string, state?: string, district?: string) {
    const schools = await this.prisma.eventSchools.findMany({
      where: {
        status: true,
        ...(board?.trim() && { board: board.trim() }),
        ...(state?.trim() && { state: state.trim() }),
        ...(district?.trim() && { district: district.trim() }),
      },
      select: {
        id: true,
        name: true,
        board: true,
        state: true,
        district: true,
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
