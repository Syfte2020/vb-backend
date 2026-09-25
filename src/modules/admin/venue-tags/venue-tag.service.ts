import {
  Injectable,
  BadRequestException,
} from "@nestjs/common";

import { InjectRepository } from "@nestjs/typeorm";

import { Repository } from "typeorm";

import { VenueTag } from "./entities/venue-tag.entity";

import { StorageService } from "src/common/storage/storage.service";

@Injectable()
export class VenueTagsService {
  constructor(
    @InjectRepository(VenueTag)
    private venueTagRepo: Repository<VenueTag>,

    private storageService: StorageService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | CREATE
  |--------------------------------------------------------------------------
  */

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
      await this.venueTagRepo.findOne({
        where: {
          name: dto.name,
        },
      });

    if (exists) {
      throw new BadRequestException(
        "Venue tag already exists",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | FILES
    |--------------------------------------------------------------------------
    */

    let iconPath:
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
      iconPath =
        await this.storageService.upload(
          icon,
          "venue-tags/icons",
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
          "venue-tags/images",
        );
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE
    |--------------------------------------------------------------------------
    */

    const tag =
      this.venueTagRepo.create({
        name: dto.name,

        cat_status:
          dto.status || "0",

        icon: iconPath,

        frontImage:
          imagePath,
      });

    return await this.venueTagRepo.save(
      tag,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | FIND ALL
  |--------------------------------------------------------------------------
  */

  async findAll(query: any) {
    const {
      page = 1,
      limit = 10,
      search = "",
    } = query;

    /*
    |--------------------------------------------------------------------------
    | QUERY
    |--------------------------------------------------------------------------
    */

    const qb =
      this.venueTagRepo.createQueryBuilder(
        "venue_tags",
      );

    /*
    |--------------------------------------------------------------------------
    | SEARCH
    |--------------------------------------------------------------------------
    */

    if (search) {
      qb.where(
        "venue_tags.name LIKE :search",
        {
          search: `%${search}%`,
        },
      );
    }

    /*
    |--------------------------------------------------------------------------
    | ORDER
    |--------------------------------------------------------------------------
    */

    qb.orderBy(
      "venue_tags.created_at",
      "DESC",
    )
      .skip(
        (Number(page) - 1) *
          Number(limit),
      )
      .take(Number(limit));

    /*
    |--------------------------------------------------------------------------
    | GET DATA
    |--------------------------------------------------------------------------
    */

    const [data, total] =
      await qb.getManyAndCount();

    /*
    |--------------------------------------------------------------------------
    | FORMAT
    |--------------------------------------------------------------------------
    */

    const formattedData = data.map(
      (item: any) => ({
        ...item,

        iconUrl: item.icon,

        frontImage:item.frontImage,
      }),
    );

    /*
    |--------------------------------------------------------------------------
    | RETURN
    |--------------------------------------------------------------------------
    */

    return {
      data: formattedData,

      pagination: {
        total,

        page: Number(page),

        limit:
          Number(limit),

        totalPages:
          Math.ceil(
            total /
              Number(limit),
          ),
      },
    };
  }

  /*
  |--------------------------------------------------------------------------
  | FIND ONE
  |--------------------------------------------------------------------------
  */

  async findOne(id: string) {
    const tag =
      await this.venueTagRepo.findOne({
        where: { id },
      });

    if (!tag) {
      throw new BadRequestException(
        "Venue tag not found",
      );
    }

    return {
      ...tag,

      iconUrl: tag.icon
        ? `${process.env.APP_URL}/${tag.icon}`
        : null,

      frontImage:
        tag.frontImage
          ? `${process.env.APP_URL}/${tag.frontImage}`
          : null,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE
  |--------------------------------------------------------------------------
  */

  async update(
    id: string,
    dto: any,
    icon: any,
    image: any,
  ) {
    /*
    |--------------------------------------------------------------------------
    | FIND
    |--------------------------------------------------------------------------
    */

    const tag =
      await this.venueTagRepo.findOne({
        where: { id },
      });

    if (!tag) {
      throw new BadRequestException(
        "Venue tag not found",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | ICON
    |--------------------------------------------------------------------------
    */

    if (icon) {
      const uploadedIcon =
        await this.storageService.upload(
          icon,
          "venue-tags/icons",
        );

      if (uploadedIcon) {
        tag.icon =
          uploadedIcon;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | IMAGE
    |--------------------------------------------------------------------------
    */

    if (image) {
      const uploadedImage =
        await this.storageService.upload(
          image,
          "venue-tags/images",
        );

      if (uploadedImage) {
        tag.frontImage =
          uploadedImage;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE FIELDS
    |--------------------------------------------------------------------------
    */

    if (dto.name) {
      tag.name = dto.name;
    }

    if (dto.status) {
      tag.cat_status =
        dto.status;
    }

    /*
    |--------------------------------------------------------------------------
    | SAVE
    |--------------------------------------------------------------------------
    */

    return await this.venueTagRepo.save(
      tag,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | DELETE
  |--------------------------------------------------------------------------
  */

  async remove(id: string) {
    /*
    |--------------------------------------------------------------------------
    | FIND
    |--------------------------------------------------------------------------
    */

    const tag =
      await this.venueTagRepo.findOne({
        where: { id },
      });

    if (!tag) {
      throw new BadRequestException(
        "Venue tag not found",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | DELETE FILES
    |--------------------------------------------------------------------------
    */

    if (tag.icon) {
      await this.storageService.delete(
        tag.icon,
      );
    }

    if (tag.frontImage) {
      await this.storageService.delete(
        tag.frontImage,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | DELETE RECORD
    |--------------------------------------------------------------------------
    */

    return await this.venueTagRepo.remove(
      tag,
    );
  }
}