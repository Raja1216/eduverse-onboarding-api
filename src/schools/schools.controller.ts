
import {
  Controller,
  Get,
  Query,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';

import { SchoolsService } from './schools.service';

@Controller('schools')
export class SchoolsController {
  constructor(
    private readonly schoolsService: SchoolsService,
  ) {}

  // 1. Get boards
  @Get('boards')
  getBoards() {
    return this.schoolsService.getBoards();
  }

  // 2. Get states by board ID
  @Get('states')
  getStates(
    @Query('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.schoolsService.getStates(boardId);
  }

  // 3. Get districts by state ID
  @Get('districts')
  getDistricts(
    @Query('stateId', ParseIntPipe) stateId: number,
  ) {
    return this.schoolsService.getDistricts(stateId);
  }

  // 4. Get schools using optional filters
  @Get()
  list(
    @Query('boardId') boardId?: string,
    @Query('stateId') stateId?: string,
    @Query('districtId') districtId?: string,
  ) {
    return this.schoolsService.list(
      this.parseOptionalId(boardId, 'boardId'),
      this.parseOptionalId(stateId, 'stateId'),
      this.parseOptionalId(districtId, 'districtId'),
    );
  }

  private parseOptionalId(
    value: string | undefined,
    field: string,
  ): number | undefined {
    if (value === undefined || value.trim() === '') {
      return undefined;
    }

    if (!/^[1-9]\d*$/.test(value.trim())) {
      throw new BadRequestException(
        `${field} must be a positive integer`,
      );
    }

    const id = Number(value);

    if (!Number.isSafeInteger(id)) {
      throw new BadRequestException(
        `Invalid ${field}`,
      );
    }

    return id;
  }
}
