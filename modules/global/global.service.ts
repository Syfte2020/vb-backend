import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository, DataSource ,Like } from 'typeorm';

import { BookingEventType } from './entities/venue-booking-types.entity';
import { VenueSubCategory } from './entities/venue-sub-category.entity';
import { VenueMainCategory } from './entities/venue-main-category.entity';
import { Country } from './entities/country.entiity';
import { Currency } from './entities/currency.entity';

import { Amenities } from '../admin/vendor/amenities/entities/amenities.entity';
import { AmenitiesCategory } from '../admin/vendor/amenities/entities/amenities-category.entity';

@Injectable()
export class GlobalService {
  constructor(
    private dataSource: DataSource,

    @InjectRepository(BookingEventType)
    private readonly eventRepo: Repository<BookingEventType>,

    @InjectRepository(VenueSubCategory)
    private readonly propRepo: Repository<VenueSubCategory>,

    @InjectRepository(VenueMainCategory)
    private readonly mainRepo: Repository<VenueMainCategory>,

    @InjectRepository(Country)
    private readonly countryRepo: Repository<Country>,
    
    @InjectRepository(Currency)
    private readonly currencyRepo: Repository<Currency>,

    @InjectRepository(Amenities)
    private readonly amenitiesRepo: Repository<Amenities>,

    @InjectRepository(AmenitiesCategory)
    private readonly categoryRepo: Repository<AmenitiesCategory>,
  ) {}

  async findEvent() {
    const events = await this.eventRepo.find({
      where: {
        status: 0,
      },
      order: {
        id: 'DESC',
      },
    });

    return events;
  }

  async findProperty(query: any) {
    const { category = '' } = query;

    const whereCondition: any = {
      cat_status: 0,
    };

    if (category) {
      whereCondition.category_id = Number(category);
    }

    const events = await this.propRepo.find({
      where: whereCondition,

      relations: ['mainCategory'],

      order: {
        id: 'DESC',
      },
    });

    return {
      success: true,
      data: events,
    };
  }
  //Same as findProperty based on name
  async findPropertyname(query: any) {
  const category = query?.category?.trim();

  const keyword = category?.trim().replace(/s$/, '');

  const whereCondition: any = {
    cat_status: 0,
  };

  if (keyword) {
    const categor = await this.mainRepo.findOne({
       where: {
    name: Like(`%${keyword}%`),
  },
    });

    if (categor?.id) {
      whereCondition.category_id = categor.id;
    } else {
      // if category not found, return empty result instead of all data
      return {
        success: true,
        data: [],
      };
    }
  }

  const events = await this.propRepo.find({
    where: whereCondition,
    relations: ['mainCategory'],
    order: {
      id: 'DESC',
    },
  });

  return {
    success: true,
    data: events,
  };
}
  async findNameProperty(query: any) {
    const { category = '' } = query;

    const qb = this.propRepo
      .createQueryBuilder('p')
      .innerJoin('p.mainCategory', 'mainCategory'); // 🔥 IMPORTANT CHANGE
    //.where('p.cat_status = :status', { status: 0 });

    if (category) {
      qb.andWhere('mainCategory.name = :name', {
        name: category,
      });
    }

    const events = await qb.orderBy('p.id', 'DESC').getMany();

    return {
      success: true,
      data: events,
    };
  }

  async LoadAllCategory() {
    const category = await this.mainRepo.find({
      order: {
        id: 'ASC',
      },
    });

    return category.map((cat) => ({
      id: cat.id,
      value: cat.name,
      label: cat.name,
      ...cat,
    }));
  }
  async LoadAllCountry() {
    const country = await this.countryRepo.find({
      order: {
        id: 'DESC',
      },
    });
    return country;
  }
  async getAllCurrencies() {
    const Currencies = await this.currencyRepo.find({
      order: {
        id: 'DESC',
      },
    });
    return Currencies;
  }

async LoadGetAmenties(query: any) {
  const { category = '' } = query;

  let categ = 0;

  if (category) {
    const cate = category.endsWith('s')
      ? category.slice(0, -1)
      : category;

    const [categoryRow] = await this.dataSource.query(
      `SELECT id FROM category WHERE name = ? LIMIT 1`,
      [cate],
    );

    categ = categoryRow?.id || 0;
  }

  const qb = this.amenitiesRepo
    .createQueryBuilder('amenity')
    .leftJoinAndSelect('amenity.category', 'category');

  // Category + Global
  if (categ > 0) {
    qb.andWhere(
      '(amenity.category_id = :categ OR amenity.category_id = 0)',
      { categ },
    );
  }

  const amenities = await qb
    .orderBy('category.category', 'ASC')
    .addOrderBy('amenity.name', 'ASC')
    .getMany();

  const groupedData = amenities.reduce((acc: any[], item: any) => {
    if (!item.category) {
      return acc; // skip global items if they have no category relation
    }

    const existingCategory = acc.find(
      (cat) => cat.id === item.category.id,
    );

    const amenityData = {
      id: item.id,
      name: item.name,
      icon: item.svg_icon,
    };

    if (existingCategory) {
      existingCategory.children.push(amenityData);
    } else {
      acc.push({
        id: item.category.id,
        category: item.category.category,
        children: [amenityData],
      });
    }

    return acc;
  }, []);

  return {
    success: true,
    data: groupedData,
  };
}
  async countryOfCategory(country_id: number) {
    const categories = await this.dataSource.query(
      `
    SELECT 
      cc.id              AS category_country_id,
      cc.country_id,
      cc.category_id,

      c.id               AS id,
      c.name             AS name,
      c.image            AS image,
      c.status           AS status,
      c.video           AS video,
      c.color           AS color
     

    FROM category_country cc
    LEFT JOIN category c 
      ON c.id = cc.category_id

    WHERE cc.country_id = ? order by c.id ASC
    `,
      [country_id],
    );

    return categories;
  }

  //getAddon

}
