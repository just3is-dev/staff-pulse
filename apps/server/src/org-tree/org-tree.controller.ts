import { Controller, Get } from '@nestjs/common';
import type { OrgNode } from '@staff-pulse/shared';
import { OrgTreeService } from './org-tree.service.js';

@Controller('api/org-tree')
export class OrgTreeController {
  constructor(private readonly orgTreeService: OrgTreeService) {}

  @Get()
  getOrgTree(): OrgNode[] {
    return this.orgTreeService.getOrgTree();
  }
}
