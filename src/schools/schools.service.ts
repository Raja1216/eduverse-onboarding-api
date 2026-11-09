import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Get boards
  async getBoards() {
    const boards = await this.prisma.eventSchoolBoard.findMany({
      where: {
        schools: {
          some: {
            status: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return {
      status: true,
      message: "Boards fetched successfully",
      data: boards,
    };
  }

  // 2. Get states by board ID
  async getStates(boardId: number) {
    const states = await this.prisma.eventSchoolState.findMany({
      where: {
        schools: {
          some: {
            boardId,
            status: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return {
      status: true,
      message: "States fetched successfully",
      data: states,
    };
  }

  // 3. Get districts by state ID
  async getDistricts(boardId: number, stateId: number) {
    const districts = await this.prisma.eventSchoolDistrict.findMany({
      where: {
        stateId,

        schools: {
          some: {
            boardId,
            status: true,
          },
        },
      },

      select: {
        id: true,
        name: true,
        stateId: true,
      },

      orderBy: {
        name: "asc",
      },
    });

    return {
      status: true,
      message: "Districts fetched successfully",
      data: districts,
    };
  }

  // 4. Filter schools by IDs
  async list(boardId?: number, stateId?: number, districtId?: number) {
    const schools = await this.prisma.eventSchools.findMany({
      where: {
        status: true,
        ...(boardId !== undefined && { boardId }),
        ...(stateId !== undefined && { stateId }),
        ...(districtId !== undefined && { districtId }),
      },

      select: {
        id: true,
        name: true,
        boardId: true,
        stateId: true,
        districtId: true,

        boardRelation: {
          select: {
            name: true,
          },
        },

        stateRelation: {
          select: {
            name: true,
          },
        },

        districtRelation: {
          select: {
            name: true,
          },
        },
      },

      orderBy: {
        name: "asc",
      },
    });

    const data = schools.map((school) => ({
      id: school.id,
      name: school.name,

      boardId: school.boardId,
      stateId: school.stateId,
      districtId: school.districtId,

      board: school.boardRelation?.name ?? null,
      state: school.stateRelation?.name ?? null,
      district: school.districtRelation?.name ?? null,
    }));

    return {
      status: true,
      message: "Schools fetched successfully",
      data,
    };
  }
}
