import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

// main.ts и тесты собирают приложение здесь же, чтобы не разойтись в конфигурации.
export async function createApp() {
  return NestFactory.create(AppModule);
}
