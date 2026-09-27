import {
  UnprocessableEntityException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function validationErrors(errors: ValidationError[]) {
  const result: Record<string, string[]> = {};

  const walk = (items: ValidationError[], parent = '') => {
    for (const item of items) {
      const field = parent ? `${parent}.${item.property}` : item.property;

      if (item.constraints) {
        result[field] = Object.values(item.constraints);
      }

      if (item.children?.length) {
        walk(item.children, field);
      }
    }
  };

  walk(errors);
  return result;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new UnprocessableEntityException({
          status: false,
          message: 'Validation failed',
          errors: validationErrors(errors),
        }),
    }),
  );

  const frontendUrl = config.get<string>('FRONTEND_URL');
  app.enableCors({
    origin: true,//frontendUrl ? frontendUrl.split(',').map((x) => x.trim()) : true,
    credentials: true,
  });

  const port = Number(config.get<string>('PORT') || 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`API running on http://localhost:${port}/api`);
}

bootstrap();
