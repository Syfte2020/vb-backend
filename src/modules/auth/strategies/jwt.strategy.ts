import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DataSource } from 'typeorm';

// Reads token from ANY place the frontend might send it
const extractToken = (req: any): string | null => {
  if (!req) return null;

  // 1. Authorization: Bearer xxx
  const bearer = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (bearer) return bearer;

  // 2. Authorization: xxx   (without "Bearer")
  const auth = req.headers?.authorization;
  if (auth && !auth.startsWith('Bearer')) return auth;

  // 3. x-access-token / token header
  if (req.headers?.['x-access-token']) return req.headers['x-access-token'];
  if (req.headers?.token) return req.headers.token;

  // 4. Cookie (works with or without cookie-parser)
  const names = ['token', 'access_token', 'accessToken', 'auth_token'];
  for (const n of names) {
    if (req.cookies?.[n]) return req.cookies[n];
  }
  const raw = req.headers?.cookie;
  if (raw) {
    for (const part of raw.split(';')) {
      const [key, ...val] = part.trim().split('=');
      if (names.includes(key)) return decodeURIComponent(val.join('='));
    }
  }

  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly dataSource: DataSource) {
    super({
      jwtFromRequest: extractToken,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: any) {
    const id = payload.sub ?? payload.id;

    // ---------- TEAM ----------
   if (payload.is_team || payload.type === 'team') {
  const [member] = await this.dataSource.query(
    `
    SELECT
      t.*,
      tm.team_id,
      tm.login_access,
      tm.venue_access,
      tm.contact_method
    FROM teams t
    LEFT JOIN team_members tm
      ON tm.user_id = t.id
    WHERE t.id = ?
    LIMIT 1
    `,
    [id],
  );

  if (!member) {
    throw new UnauthorizedException('Team member not found');
  }

  const permissions = await this.dataSource.query(
    `
    SELECT DISTINCT p.name
    FROM system_role_permissions srp
    INNER JOIN permissions p
      ON p.id = srp.permission_id
    WHERE srp.role_id = ?
    `,
    [member.role_id],
  );

  return {
    ...member,
    is_team: true,
    owner_id: member.vendor_user_id,
    permissions: permissions.map((p: any) => p.name),
  };
}

    // ---------- VENDOR ----------
    const [user] = await this.dataSource.query(
      `SELECT * FROM users WHERE id = ? LIMIT 1`,
      [id],
    );
    if (!user) throw new UnauthorizedException('User not found');

    return { ...user, is_team: false };
  }
}