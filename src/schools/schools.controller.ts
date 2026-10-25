
import {
  Controller,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { SchoolsService } from './schools.service';

@Controller('schools')
export class SchoolsController {
  constructor(
    private readonly schoolsService: SchoolsService,
  ) {}

  @Get('boards')
  getBoards() {
    return this.schoolsService.getBoards();
  }

  @Get('states')
  getStates(@Query('board') board?: string) {
    if (!board?.trim()) {
      throw new BadRequestException('Board is required');
    }

    return this.schoolsService.getStates(board.trim());
  }

  @Get('districts')
  getDistricts(
    @Query('board') board?: string,
    @Query('state') state?: string,
  ) {
    if (!board?.trim() || !state?.trim()) {
      throw new BadRequestException(
        'Board and state are required',
      );
    }

    return this.schoolsService.getDistricts(
      board.trim(),
      state.trim(),
    );
  }

  @Get()
  list(
    @Query('board') board?: string,
    @Query('state') state?: string,
    @Query('district') district?: string,
  ) {
    return this.schoolsService.list(
      board,
      state,
      district,
    );
  }
}
