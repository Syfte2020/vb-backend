import { Injectable, UnauthorizedException ,BadRequestException, ConflictException,NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';



@Injectable()
export class AuthService {
  constructor(
    private dataSource: DataSource,
    private readonly jwtService: JwtService
  ) {}

   async login(dto) {
      const users = await this.dataSource.query(
        `SELECT users.* FROM users LEFT JOIN user_roles ON user_roles.user_id = users.id WHERE email = ? AND user_roles.role_id = 1`,
        [dto.email],
      );
  
      const user = users[0];
  
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }
  
      const isMatch = await bcrypt.compare(dto.password, user.password);
  
      if (!isMatch) {
        throw new UnauthorizedException('Invalid credentials');
      }
  
      const token = this.jwtService.sign({
        id: user.id,
      });
  
      return {
        token: token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      };
    }

    async findById(id: string) {
  const users = await this.dataSource.query(
    `SELECT * FROM users WHERE id = ?`,
    [id],
  );

  const user = users[0];

  if (!user) {
    throw new NotFoundException('User not found');
  }

  return user;
}

}