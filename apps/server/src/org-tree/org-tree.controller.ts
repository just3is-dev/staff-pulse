import { Controller, Get, Headers, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { OrgNode } from '@staff-pulse/shared';
import { computeEtag, ifNoneMatchIncludes } from './etag.js';
import { OrgTreeService } from './org-tree.service.js';

@Controller('api/org-tree')
export class OrgTreeController {
  constructor(private readonly orgTreeService: OrgTreeService) {}

  // Условный запрос проверяем сами: браузер при явном If-None-Match добавляет
  // Cache-Control: no-cache, и встроенная проверка Express отвечает на него 200.
  @Get()
  getOrgTree(
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): OrgNode[] | undefined {
    const nodes = this.orgTreeService.getOrgTree();
    const etag = computeEtag(JSON.stringify(nodes));
    response.setHeader('ETag', etag);

    if (ifNoneMatchIncludes(ifNoneMatch, etag)) {
      response.status(HttpStatus.NOT_MODIFIED);
      return undefined;
    }
    return nodes;
  }
}
