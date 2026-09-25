// import { Injectable, UnauthorizedException } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';

// @Injectable()
// export class JwtAuthGuard extends AuthGuard('jwt') {
//   handleRequest(err: any, user: any, info: any) {
//     if (err || !user) {
//       console.log('[JWT] error:', err?.message, '| info:', info?.message);
//       throw err || new UnauthorizedException(info?.message || 'Unauthorized');
//     }
//     return user;
//   }
// }

import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    console.log('[JWT] url:', req.method, req.url);
    console.log('[JWT] authorization header:', req.headers?.authorization);
    console.log('[JWT] cookies:', req.cookies);
    console.log('[JWT] raw cookie header:', req.headers?.cookie);
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      console.log('[JWT] error:', err?.message, '| info:', info?.message);
      throw err || new UnauthorizedException(info?.message || 'Unauthorized');
    }
    return user;
  }
}