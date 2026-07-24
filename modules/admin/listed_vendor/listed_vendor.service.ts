import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
// import { User } from "./entities/users.entity";

@Injectable()
export class ListedVendorService {
  constructor(private dataSource: DataSource) {}

  // ✅ GET ALL
  async findAll(query: any ,country:any ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const offset = (page - 1) * limit;
    const data = await this.dataSource.query(
      `
    SELECT *
    FROM users
    WHERE vendor_id IS NOT NULL AND country = ?
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
    `,
      [country,limit, offset],
    );

    const totalResult = await this.dataSource.query(
      `
    SELECT COUNT(*) as total
    FROM users
    WHERE vendor_id IS NOT NULL AND country = ?
    `,[country]
    );

    const total = totalResult[0].total;

    return {
      data,
      total,
      page,
      limit,
      lastPage: Math.ceil(total / limit),
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
