import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api', {
    exclude: ['/', '/health'],
  });
  const configService = app.get(ConfigService);

  app.use(helmet());

  app.enableCors({
    // Strip any trailing slash — the browser's Origin header never has one,
    // and the cors package matches origin by exact string.
    origin: configService.get('frontendUrl')?.replace(/\/$/, ''),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, //Removes extra fields
      forbidNonWhitelisted: true, //Rejects extra fields
      transform: true, //Converts data to expected types
    }),
  );

  if (configService.get('nodeEnv') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Repress API')
      .setDescription('API Documentation for Repress backend')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server is running on http://localhost:${port}`);
}

bootstrap();
