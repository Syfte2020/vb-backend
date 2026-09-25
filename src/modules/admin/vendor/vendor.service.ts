import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { DataSource, Repository } from 'typeorm';

import { InjectRepository } from '@nestjs/typeorm';

import { Amenities } from './amenities/entities/amenities.entity';

import { AmenitiesCategory } from './amenities/entities/amenities-category.entity';

import { validate as isUUID } from 'uuid';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class VendorService {
  constructor(
    private dataSource: DataSource,
    private readonly activityLogsService: ActivityLogsService,
    @InjectRepository(Amenities)
    private readonly amenitiesRepo: Repository<Amenities>,

    @InjectRepository(AmenitiesCategory)
    private readonly categoryRepo: Repository<AmenitiesCategory>,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | GET AMENITIES
  |--------------------------------------------------------------------------
  */

  //   async GetAmenities() {
  //     const amenities = await this.amenitiesRepo.find({
  //       relations: {
  //         category: true,
  //       },

  //       order: {
  //         updated_at: 'DESC',
  //       },
  //     });

  //    return amenities.map((item) => ({

  //   id: item.id,

  //   name: item.name,

  //   category:
  //     item.category?.category || null,

  //   amenities_category_id:
  //     item.amenities_category_id,

  // }));
  //   }
  async GetAmenities(page = 1, limit = 10, search = '', category = '') {
    const skip = (page - 1) * limit;

    const query = this.amenitiesRepo
      .createQueryBuilder('amenity')

      .leftJoinAndSelect('amenity.category', 'category');

    /*
  |--------------------------------------------------------------------------
  | SEARCH
  |--------------------------------------------------------------------------
  */

    if (search) {
      query.where(
        `
      amenity.name LIKE :search
      OR
      category.category LIKE :search
      `,
        {
          search: `%${search}%`,
        },
      );
    }
    if (category) {
      query.andWhere('amenity.amenities_category_id = :category', {
        category,
      });
    }

    /*
  |--------------------------------------------------------------------------
  | TOTAL COUNT
  |--------------------------------------------------------------------------
  */

    const total = await query.getCount();

    /*
  |--------------------------------------------------------------------------
  | DATA
  |--------------------------------------------------------------------------
  */

    const data = await query

      .orderBy('amenity.updated_at', 'DESC')

      .skip(skip)

      .take(limit)

      .getMany();

    return {
      data: data.map((item) => ({
        id: item.id,

        name: item.name,

        category: item.category?.category,

        amenities_category_id: item.amenities_category_id,
        category_id:item.category_id,
        svg_icon:item.svg_icon,
      })),

      pagination: {
        total,

        currentPage: page,

        totalPages: Math.ceil(total / limit),

        limit,
      },
    };
  }
  /*
  |--------------------------------------------------------------------------
  | GET CATEGORY DROPDOWN
  |--------------------------------------------------------------------------
  */

  async amenities_category() {
    return this.categoryRepo
      .createQueryBuilder('c')

      .select(['c.id AS id', 'c.category AS value', 'c.category AS label'])

      .where('c.category IS NOT NULL')

      .orderBy('c.category', 'ASC')

      .getRawMany();
  }

  /*
  |--------------------------------------------------------------------------
  | INSERT AMENITY
  |--------------------------------------------------------------------------
  */

  async amenitiesInsert(
    dto: any,
    userId?: string,
    ipAddress?: string,
    useragent?: string,
  ) {
    const { name, category, category_id, svg_icon, created_by  } = dto;

    console.log(dto)
    /*
  |--------------------------------------------------------------------------
  | VALIDATION
  |--------------------------------------------------------------------------
  */

    if (!name?.trim()) {
      throw new BadRequestException('Amenity name is required');
    }

    if (!category?.trim()) {
      throw new BadRequestException('Category is required');
    } 
    
    if (!category_id?.trim()) {
      throw new BadRequestException('category_id is required');
    }

    const cleanName = name.trim().replace(/\s+/g, ' ');

    let categoryId = category;

    /*
  |--------------------------------------------------------------------------
  | CATEGORY HANDLING
  |--------------------------------------------------------------------------
  */

    if (!isUUID(category)) {
      let existingCategory = await this.categoryRepo.findOne({
        where: {
          category: category.trim(),
        },
      });

      if (!existingCategory) {
        const newCategory = this.categoryRepo.create({
          category: category.trim(),
          vendor_id: created_by,
        });

        existingCategory = await this.categoryRepo.save(newCategory);
      }

      categoryId = existingCategory.id;
    }

    /*
  |--------------------------------------------------------------------------
  | DUPLICATE CHECK
  |--------------------------------------------------------------------------
  */

    const existingAmenity = await this.amenitiesRepo
      .createQueryBuilder('amenity')
      .where('LOWER(amenity.name) = LOWER(:name)', {
        name: cleanName,
      })
      .andWhere('amenity.amenities_category_id = :categoryId', {
        categoryId,
      })
      .getOne();

    if (existingAmenity) {
      throw new ConflictException('Amenity already exists in this category');
    }

    /*
  |--------------------------------------------------------------------------
  | CREATE AMENITY
  |--------------------------------------------------------------------------
  */

    const amenity = this.amenitiesRepo.create({
      name: cleanName,
      amenities_category_id: categoryId,
      category_id: category_id,
      svg_icon: svg_icon,
      created_by,
    });

    const savedAmenity = await this.amenitiesRepo.save(amenity);

    /*
  |--------------------------------------------------------------------------
  | ACTIVITY LOG
  |--------------------------------------------------------------------------
  */

    await this.activityLogsService.create({
      action: 'CREATE',
      module: 'Amenities',
      module_id: savedAmenity.id,
      user_id: userId || created_by,
      description: `Created amenity "${savedAmenity.name}"`,
      ip_address: ipAddress || null,
      user_agent: useragent || null,
    });

    return savedAmenity;
  }

  async updateAmenity(
    id: string,
    dto: any,
    userId?: string,
    ip?: string,
    userAgent?: string,
  ) {
    const { name, category , category_id, svg_icon} = dto;

    /*
  |--------------------------------------------------------------------------
  | VALIDATION
  |--------------------------------------------------------------------------
  */

    if (!name?.trim()) {
      throw new BadRequestException('Amenity name is required');
    }

    if (!category?.trim()) {
      throw new BadRequestException('Category is required');
    } 
    if (!category_id?.trim()) {
      throw new BadRequestException('category_id is required');
    }

    /*
  |--------------------------------------------------------------------------
  | CLEAN NAME
  |--------------------------------------------------------------------------
  */

    const cleanName = name.trim().replace(/\s+/g, ' ');

    /*
  |--------------------------------------------------------------------------
  | FIND EXISTING AMENITY
  |--------------------------------------------------------------------------
  */

    const amenity = await this.amenitiesRepo.findOne({
      where: { id },
    });

    if (!amenity) {
      throw new BadRequestException('Amenity not found');
    }
    const oldData = { ...amenity };
    let categoryId = category;

    /*
  |--------------------------------------------------------------------------
  | CREATE CATEGORY IF TEXT
  |--------------------------------------------------------------------------
  */

    if (!isUUID(category)) {
      let existingCategory = await this.categoryRepo.findOne({
        where: {
          category: category.trim(),
        },
      });

      /*
    |--------------------------------------------------------------------------
    | CREATE NEW CATEGORY
    |--------------------------------------------------------------------------
    */

      if (!existingCategory) {
        const newCategory = this.categoryRepo.create({
          category: category.trim().replace(/\s+/g, ' '),
        });

        existingCategory = await this.categoryRepo.save(newCategory);
      }

      categoryId = existingCategory.id;
    }

    /*
  |--------------------------------------------------------------------------
  | DUPLICATE VALIDATION
  |--------------------------------------------------------------------------
  */

    const duplicateAmenity = await this.amenitiesRepo

      .createQueryBuilder('amenity')

      .where(
        `
        LOWER(TRIM(amenity.name))
        =
        LOWER(TRIM(:name))
        `,
        {
          name: cleanName,
        },
      )

      .andWhere(
        `
        amenity.amenities_category_id
        =
        :categoryId
        `,
        {
          categoryId,
        },
      )

      .getOne();

    /*
  |--------------------------------------------------------------------------
  | CHECK DUPLICATE
  |--------------------------------------------------------------------------
  */

    if (duplicateAmenity && duplicateAmenity.id !== id) {
      throw new ConflictException('Amenity already exists in this category');
    }

    /*
  |--------------------------------------------------------------------------
  | UPDATE
  |--------------------------------------------------------------------------
  */

    amenity.name = cleanName;

    amenity.amenities_category_id = categoryId;
    amenity.category_id = category_id;
    amenity.svg_icon = svg_icon;
    // return await this.amenitiesRepo.save(amenity);
    const updated = await this.amenitiesRepo.save(amenity);

    await this.activityLogsService.create({
      action: 'UPDATE',

      module: 'Amenities',

      module_id: id,

      user_id: userId,

      description: `Updated amenity "${oldData.name}" → "${updated.name}"`,

      ip_address: ip,

      user_agent: userAgent,

      metadata: {
        before: oldData,
        after: updated,
      },
    });

    return updated;
  }

  async deleteAmenity(
    id: string,
    userId?: string,
    ip?: string,
    userAgent?: string,
  ) {
    const amenity = await this.amenitiesRepo.findOne({
      where: { id },
    });

    if (!amenity) {
      throw new BadRequestException('Amenity not found');
    }

    await this.amenitiesRepo.delete(id);
    await this.activityLogsService.create({
      action: 'DELETE',

      module: 'Amenities',

      module_id: id,

      user_id: userId,

      description: `Deleted amenity "${amenity.name}"`,

      ip_address: ip,

      user_agent: userAgent,

      metadata: amenity,
    });

    return {
      message: 'Amenity deleted successfully',
    };
  }
}
