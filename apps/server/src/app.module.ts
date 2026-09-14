import { Module } from '@nestjs/common';
import { OrgTreeModule } from './org-tree/org-tree.module.js';

@Module({
  imports: [OrgTreeModule],
})
export class AppModule {}
