import { Module } from '@nestjs/common';
import { OrgTreeController } from './org-tree.controller.js';
import { OrgTreeService } from './org-tree.service.js';

@Module({
  controllers: [OrgTreeController],
  providers: [OrgTreeService],
})
export class OrgTreeModule {}
