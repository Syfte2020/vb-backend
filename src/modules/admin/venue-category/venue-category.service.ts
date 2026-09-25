import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Category } from "./entities/category.entity";
import { VenueCategory } from "./entities/venue-category.entity";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { StorageService } from "src/common/storage/storage.service";

@Injectable()
export class VenueCategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepo: Repository<Category>,

    @InjectRepository(VenueCategory)
    private VenuecategoryRepo: Repository<VenueCategory>,

    private storageService: StorageService,
  ) {}

  // ✅ CREATE
  async create(
 dto: any, icon: any, image: any
) {

  let categoryId;

  // CHECK CATEGORY
  const isNumber = !isNaN(Number(dto.category));

  if (isNumber) {

    // EXISTING CATEGORY
    const existingCategory = await this.categoryRepo.findOne({
      where: { id: Number(dto.category) },
    });

    if (!existingCategory) {
      throw new BadRequestException("Category not found");
    }

    categoryId = existingCategory.id;

  } else {

    // NEW CATEGORY CREATE
    let newCategory = await this.categoryRepo.findOne({
      where: { name: dto.category },
    });

    // AVOID DUPLICATE CATEGORY
    if (!newCategory) {
      newCategory = this.categoryRepo.create({
        name: dto.category,
      });

      newCategory = await this.categoryRepo.save(newCategory);
    }

    categoryId = newCategory.id;
  }

   let iconPath: string | undefined;
    let imagePath: string | undefined;

    if (icon) {
      iconPath = await this.storageService.upload(
        icon,
        "venue-tags/icons",
      );
    }

    if (image) {
      imagePath = await this.storageService.upload(
        image,
        "venue-tags/images",
      );
    }

  // CREATE SUBCATEGORY
  const tag = this.VenuecategoryRepo.create({
    name: dto.name,
    cat_status: dto.status || "0",
    icon: iconPath,
    frontImage: imagePath,
    category_id: categoryId,
  });

  return await this.VenuecategoryRepo.save(tag);
}


  // ✅ GET ALL
  async findAll(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const search = query.search || "";
    const category = query.category || "";

    const skip = (page - 1) * limit;

    const qb = this.VenuecategoryRepo.createQueryBuilder("vc")
      .leftJoinAndSelect("vc.category", "category")
      .orderBy("vc.id", "DESC")
      .skip(skip)
      .take(limit);

    if (search) {
      qb.andWhere(
        "(vc.name LIKE :search OR category.name LIKE :search)",
        { search: `%${search}%` },
      );
    }
     if (category) {
      qb.andWhere('vc.category_id = :category', {
        category,
      });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ✅ CATEGORY LIST
  async category() {
    const categories = await this.categoryRepo.find();

    if (!categories || categories.length === 0) {
      throw new NotFoundException("No categories found");
    }

    return categories.map((cat) => ({
      id: cat.id,
      value: cat.name,
      label: cat.name,
    }));
  }

  // ✅ FIND ONE
  async findOne(id: number) {
    const category = await this.categoryRepo.findOne({
      where: { id },
      relations: ["venueCategories"],
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    return category;
  }

  // ✅ UPDATE
  async update(id: string, dto: any, icon: any, image: any) {
    const tag = await this.VenuecategoryRepo.findOne({
      where: { id: Number(id) },
    });

    if (!tag) {
      throw new BadRequestException("Venue tag not found");
    }

    if (icon) {
      const uploadedIcon = await this.storageService.upload(
        icon,
        "venue-tags/icons",
      );

      if (uploadedIcon) {
        tag.icon = uploadedIcon;
      }
    }

    if (image) {
      const uploadedImage = await this.storageService.upload(
        image,
        "venue-tags/images",
      );

      if (uploadedImage) {
        tag.frontImage = uploadedImage;
      }
    }

    if (dto.name) {
      tag.name = dto.name;
    }

    if (dto.category_id !== undefined) {
      tag.category_id = Number(dto.category_id);
    }

    if (dto.status !== undefined) {
      tag.cat_status = dto.status;
    }

    return await this.VenuecategoryRepo.save(tag);
  }

  // ✅ DELETE (FIXED)
  async remove(id: number) {
    const category = await this.VenuecategoryRepo.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    return await this.VenuecategoryRepo.remove(category);
  }
}