import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<string[]>('permissions', context.getHandler());
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user;

    // Vendor → full access
    if (!user?.is_team) return true;

    // Team → check permissions
    const userPermissions: string[] = user.permissions || [];
    const allowed = required.every((p) => userPermissions.includes(p));

    if (!allowed) throw new ForbiddenException('You do not have permission');
    return true;
  }
}