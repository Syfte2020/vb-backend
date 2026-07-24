import {
  Injectable,
  BadRequestException,
} from "@nestjs/common";

import { InjectRepository } from "@nestjs/typeorm";

import { Repository } from "typeorm";

import { EventTag } from "./entities/event-tag.entity";

import { StorageService } from "src/common/storage/storage.service";

@Injectable()
export class EventTagsService {
  constructor(
    @InjectRepository(EventTag)
    private eventTagRepo: Repository<EventTag>,

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
      await this.eventTagRepo.findOne({
        where: {
          event_name: dto.name,
        },
      });

    if (exists) {

      throw new BadRequestException(
        "Event tag already exists",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | FILE PATHS
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
          "event-tags/icons",
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
          "event-tags/images",
        );
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE TAG
    |--------------------------------------------------------------------------
    */

    const tag =
      this.eventTagRepo.create({
        event_name:
         dto.name,

        status:
          dto.status || "0",

         icon: iconPath,

    frontImage: imagePath
      });

    return await this.eventTagRepo.save(
      tag,
    );

  
  }

  /*
  |--------------------------------------------------------------------------
  | FIND ALL
  |--------------------------------------------------------------------------
  */

  async findAll(
    query: any,
  ) {

    const {
      page = 1,
      limit = 10,
      search = "",
    } = query;

    /*
    |--------------------------------------------------------------------------
    | QUERY BUILDER
    |--------------------------------------------------------------------------
    */

    const qb =
      this.eventTagRepo.createQueryBuilder(
        "event_tags",
      );

    /*
    |--------------------------------------------------------------------------
    | SEARCH
    |--------------------------------------------------------------------------
    */

    if (search) {

      qb.where(
        "event_tags.event_name LIKE :search",
        {
          search: `%${search}%`,
        },
      );
    }

    /*
    |--------------------------------------------------------------------------
    | ORDER & PAGINATION
    |--------------------------------------------------------------------------
    */

    qb.orderBy(
      "event_tags.created_at",
      "DESC",
    )
      .skip(
        (Number(page) - 1) *
          Number(limit),
      )
      .take(
        Number(limit),
      );

    /*
    |--------------------------------------------------------------------------
    | GET DATA
    |--------------------------------------------------------------------------
    */

    const [data, total] =
      await qb.getManyAndCount();

    /*
    |--------------------------------------------------------------------------
    | FORMAT RESPONSE
    |--------------------------------------------------------------------------
    */

    const formattedData =
      data.map(
        (item: any) => ({

          id: item.id,

          name:
            item.event_name,

          status:
            item.status,

          icon:
            item.icon,

          frontImage:
            item.frontImage,

          iconUrl:
            item.icon,

          created_at:
            item.created_at,

          updated_at:
            item.updated_at,
        }),
      );

    /*
    |--------------------------------------------------------------------------
    | RETURN
    |--------------------------------------------------------------------------
    */

    return {

      data:
        formattedData,

      pagination: {

        total,

        page:
          Number(page),

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

  async findOne(
    id: string,
  ) {

    const tag =
      await this.eventTagRepo.findOne({
        where: { id },
      });

    if (!tag) {

      throw new BadRequestException(
        "Event tag not found",
      );
    }

    return {

      id: tag.id,

      name:
        tag.event_name,

      status:
        tag.status,

      icon:
        tag.icon,

      frontImage:
        tag.frontImage
          ? `${process.env.APP_URL}/${tag.frontImage}`
          : null,

      iconUrl:
        tag.icon
          ? `${process.env.APP_URL}/${tag.icon}`
          : null,

      created_at:
        tag.created_at,

      updated_at:
        tag.updated_at,
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
    | FIND TAG
    |--------------------------------------------------------------------------
    */

    const tag =
      await this.eventTagRepo.findOne({
        where: { id },
      });

    if (!tag) {

      throw new BadRequestException(
        "Event tag not found",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | ICON
    |--------------------------------------------------------------------------
    */

    if (
      icon &&
      icon.filename
    ) {

      const uploadedIcon =
        await this.storageService.upload(
          icon,
          "event-tags/icons",
        );

      if (
        uploadedIcon
      ) {

        if (tag.icon) {

          await this.storageService.delete(
            tag.icon,
          );
        }

        tag.icon =
          uploadedIcon;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | IMAGE
    |--------------------------------------------------------------------------
    */

    if (
      image &&
      image.filename
    ) {

      const uploadedImage =
        await this.storageService.upload(
          image,
          "event-tags/images",
        );

      if (
        uploadedImage
      ) {

        if (
          tag.frontImage
        ) {

          await this.storageService.delete(
            tag.frontImage,
          );
        }

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

      tag.event_name =
        dto.name;
    }

    if (dto.status) {

      tag.status =
        dto.status;
    }

    /*
    |--------------------------------------------------------------------------
    | SAVE
    |--------------------------------------------------------------------------
    */

    return await this.eventTagRepo.save(
      tag,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | DELETE
  |--------------------------------------------------------------------------
  */

  async remove(
    id: string,
  ) {

    /*
    |--------------------------------------------------------------------------
    | FIND TAG
    |--------------------------------------------------------------------------
    */

    const tag =
      await this.eventTagRepo.findOne({
        where: { id },
      });

    if (!tag) {

      throw new BadRequestException(
        "Event tag not found",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | DELETE ICON
    |--------------------------------------------------------------------------
    */

    if (tag.icon) {

      await this.storageService.delete(
        tag.icon,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | DELETE IMAGE
    |--------------------------------------------------------------------------
    */

    if (
      tag.frontImage
    ) {

      await this.storageService.delete(
        tag.frontImage,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | DELETE RECORD
    |--------------------------------------------------------------------------
    */

    return await this.eventTagRepo.remove(
      tag,
    );
  }
}