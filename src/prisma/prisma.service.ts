import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly configService: ConfigService) {
    const adapter = new PrismaMariaDb({
      host: configService.get<string>("DATABASE_HOST"),
      port: Number(configService.get<string>("DATABASE_PORT") || 3306),
      user: configService.get<string>("DATABASE_USER"),
      password: configService.get<string>("DATABASE_PASSWORD"),
      database: configService.get<string>("DATABASE_NAME"),

      connectionLimit: 10,
      acquireTimeout: 10000,
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
