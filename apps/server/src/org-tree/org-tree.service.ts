import { Injectable } from '@nestjs/common';
import type { OrgNode } from '@staff-pulse/shared';
import { ORG_TREE } from './org-tree.data.js';

@Injectable()
export class OrgTreeService {
  getOrgTree(): OrgNode[] {
    return ORG_TREE;
  }
}
