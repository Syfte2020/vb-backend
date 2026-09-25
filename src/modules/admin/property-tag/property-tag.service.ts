import {
  Injectable,
  BadRequestException,
} from "@nestjs/common";

import { InjectRepository } from "@nestjs/typeorm";

import { Repository } from "typeorm";

import { Category } from "./entities/property-tag.entity";
import { CategoryCountry } from "./entities/category-country.entity";

import { StorageService } from "src/common/storage/storage.service";
@Injectable()
export class PropertyTagService {
     constructor(
        @InjectRepository(Category)
        private categoryRepo: Repository<Category>,  
        
        @InjectRepository(CategoryCountry)
        private categoryCountryRepo: Repository<CategoryCountry>,
    
        private storageService: StorageService,
      ) {}
async findAll(query: any) {
  const {
    page = 1,
    limit = 10,
    search = "",
  } = query;

  const qb = this.categoryRepo
    .createQueryBuilder("category")

    // relations
    .leftJoinAndSelect(
      "category.categoryCountries",
      "categoryCountry"
    )
    .leftJoinAndSelect(
      "categoryCountry.country",
      "country"
    );

  /*
  |--------------------------------------------------------------------------
  | SEARCH
  |--------------------------------------------------------------------------
  */

  if (search) {
    qb.where("category.name LIKE :search", {
      search: `%${search}%`,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | PAGINATION
  |--------------------------------------------------------------------------
  */

  qb.orderBy("category.created_at", "DESC")
    .skip((Number(page) - 1) * Number(limit))
    .take(Number(limit));

  const [data, total] = await qb.getManyAndCount();

  /*
  |--------------------------------------------------------------------------
  | FORMAT RESPONSE
  |--------------------------------------------------------------------------
  */

  const formattedData = data.map((item: any) => ({
    id: item.id,
    name: item.name,
    image: item.image,
    video: item.video,
    stat: item.stat,
    status: item.status,
    created_at: item.created_at,

    // 🔥 add countries here
    countries: item.categoryCountries?.map((cc: any) => ({
      id: cc.country?.id,
      name: cc.country?.name,
      iso_code: cc.country?.iso_code,
      phone_code: cc.country?.phone_code,
    })) || [],
  }));

  return {
    data: formattedData,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
}

async create(
    dto: any,
    icon: any,
    image: any,
  ) {

    /*
    |--------------------------------------------------------------------------
    | CHECK EXISTS
    |--------------------------------------------------------------------------
    */

    const exists =
      await this.categoryRepo.findOne({
        where: {
          name: dto.name,
        },
      });

    if (exists) {

      throw new BadRequestException(
        "category tag already exists",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | FILE PATHS
    |--------------------------------------------------------------------------
    */

    let videoPath:
      | string
      | undefined;

    let imagePath:
      | string
      | undefined;

    /*
    |--------------------------------------------------------------------------
    | ICON
    |--------------------------------------------------------------------------
    */

    if (icon) {
      videoPath =
        await this.storageService.upload(
          icon,
          "vb_video",
        );
    }

    /*
    |--------------------------------------------------------------------------
    | IMAGE
    |--------------------------------------------------------------------------
    */

    if (image) {
      imagePath =
        await this.storageService.upload(
          image,
          "Properties",
        );
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE TAG
    |--------------------------------------------------------------------------
    */

    const tag = this.categoryRepo.create({
  name: dto.name,

  status: dto.status || "0",


  image: videoPath,

  video: imagePath, // ✅ ADD VIDEO

  // active_countries

  /*
  |--------------------------------------------------------------------------
  | STAT JSON
  |--------------------------------------------------------------------------
  */

  stat: dto.stat
    ? typeof dto.stat === "string"
      ? JSON.parse(dto.stat)
      : dto.stat
    : null,
});

const savedCategory = await this.categoryRepo.save(tag);

console.log(dto.active_countries)

const countries =
  typeof dto.active_countries === "string"
    ? JSON.parse(dto.active_countries)
    : dto.active_countries || [];

if (countries.length) {
  await this.categoryCountryRepo.insert(
    countries.map((countryId: number) => ({
      category_id: savedCategory.id,
      country_id: countryId,
    }))
  );
}

  
  }


   async update(id: number, dto: any, image: any, video: any) {
    /*
  |--------------------------------------------------------------------------
  | CHECK EXISTS
  |--------------------------------------------------------------------------
  */

    const existing = await this.categoryRepo.findOne({
      where: { id },
    });

    if (!existing) {
      throw new BadRequestException('Category not found');
    }

    /*
  |--------------------------------------------------------------------------
  | DUPLICATE NAME CHECK (optional safe)
  |--------------------------------------------------------------------------
  */

    // const duplicate = await this.categoryRepo.findOne({
    //   where: { name: dto.name },
    // });

    // if (duplicate && duplicate.id !== id) {
    //   throw new BadRequestException('Category tag already exists');
    // }

    /*
  |--------------------------------------------------------------------------
  | FILE PATHS
  |--------------------------------------------------------------------------
  */

    let imagePath: string | undefined;
    let videoPath: string | undefined;

    /*
  |--------------------------------------------------------------------------
  | IMAGE
  |--------------------------------------------------------------------------
  */

    if (image) {
      imagePath = await this.storageService.upload(image, 'images');
    }

    /*
  |--------------------------------------------------------------------------
  | VIDEO
  |--------------------------------------------------------------------------
  */

    if (video) {
      videoPath = await this.storageService.upload(video, 'videos');
    }

    /*
  |--------------------------------------------------------------------------
  | UPDATE DATA
  |--------------------------------------------------------------------------
  */

    existing.name = dto.name;
    existing.status = dto.status || '0';
    if (imagePath) existing.image = imagePath;
    if (videoPath) existing.video = videoPath;

    /*
  |--------------------------------------------------------------------------
  | STAT JSON
  |--------------------------------------------------------------------------
  */

    if (dto.stat) {
      existing.stat =
        typeof dto.stat === 'string' ? JSON.parse(dto.stat) : dto.stat;
    }

    await this.categoryRepo.save(existing);

    //Update Country
    const countries =
  typeof dto.active_countries === "string"
    ? JSON.parse(dto.active_countries)
    : dto.active_countries || [];

    await this.categoryCountryRepo.delete({
  category_id: id,
});

if (countries.length) {
  await this.categoryCountryRepo.insert(
    countries.map((countryId: number) => ({
      category_id: id,
      country_id: countryId,
    }))
  );
}
  }

   async remove(
    id: number,
  ) {

    /*
    |--------------------------------------------------------------------------
    | FIND TAG
    |--------------------------------------------------------------------------
    */

    const tag =
      await this.categoryRepo.findOne({
        where: { id },
      });

    if (!tag) {

      throw new BadRequestException(
        "Ctegory tag not found",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | DELETE ICON
    |--------------------------------------------------------------------------
    */

    if (tag.image) {

      await this.storageService.delete(
        tag.image,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | DELETE IMAGE
    |--------------------------------------------------------------------------
    */

    if (
      tag.video
    ) {

      await this.storageService.delete(
        tag.video,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | DELETE RECORD
    |--------------------------------------------------------------------------
    */

    return await this.categoryRepo.remove(
      tag,
    );
  }

}
