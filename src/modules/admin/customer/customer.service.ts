import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
// import { User } from "./entities/users.entity";

@Injectable()
export class CustomerService {
  constructor(private dataSource: DataSource) {}

async findAll(query: any) {
  const page = Number(query.page) || 1;

  const limit = Number(query.limit) || 10;

  const offset = (page - 1) * limit;

  /*
  |--------------------------------------------------------------------------
  | GET USERS
  |--------------------------------------------------------------------------
  */

  const data = await this.dataSource.query(
    `
    SELECT DISTINCT users.*
    FROM users
    LEFT JOIN user_roles 
      ON user_roles.user_id = users.id
    WHERE user_roles.role_id != ?
    ORDER BY users.updated_at DESC
    LIMIT ? OFFSET ?
    `,
    [1, limit, offset],
  );

  /*
  |--------------------------------------------------------------------------
  | TOTAL COUNT
  |--------------------------------------------------------------------------
  */

  const totalResult = await this.dataSource.query(
    `
    SELECT COUNT(DISTINCT users.id) as total
    FROM users
    LEFT JOIN user_roles 
      ON user_roles.user_id = users.id
    WHERE user_roles.role_id != ?
    `,
    [1],
  );

  const total = Number(totalResult[0]?.total) || 0;

  return {
    data,

    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

  // ✅ FIND ONE
  // async findOne(id: number) {
  //   const category = await this.categoryRepo.findOne({
  //     where: { id },
  //     relations: ["venueCategories"],
  //   });

  //   if (!category) {
  //     throw new NotFoundException("Category not found");
  //   }

  //   return category;
  // }
}
