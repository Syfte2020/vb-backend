import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Country } from "./entities/country.entity";
import { CreateCountryDto } from "./dto/create-country.dto";
import { UpdateCountryDto } from "./dto/update-country.dto";

@Injectable()
export class CountryService {

  constructor(
    @InjectRepository(Country)
    private countryRepo: Repository<Country>,
  ) {}

  /* CREATE */
  async create(dto: CreateCountryDto, userId: string) {

    const exists = await this.countryRepo.findOne({
      where: { iso_code: dto.iso_code },
    });

    if (exists) {
      throw new BadRequestException("Country already exists");
    }

    const country = this.countryRepo.create({
      ...dto,
    //   created_by: userId,
    });

    return await this.countryRepo.save(country);
  }

  /* FIND ALL */
  async findAll(query: any) {

    const { page = 1, limit = 10, search = "" } = query;

    const qb = this.countryRepo.createQueryBuilder("country");

    if (search) {
      qb.where(
        "country.name LIKE :search OR country.iso_code LIKE :search",
        { search: `%${search}%` },
      );
    }

    qb.orderBy("country.created_at", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /* FIND ONE */
  async findOne(id: string) {
    return await this.countryRepo.findOne({ where: { id } });
  }

  /* UPDATE */
  async update(id: string, dto: UpdateCountryDto) {

    const country = await this.countryRepo.findOne({
      where: { id },
    });

    if (!country) {
      throw new BadRequestException("Country not found");
    }

    Object.assign(country, dto);

    return await this.countryRepo.save(country);
  }

  /* DELETE */
  async remove(id: string) {

    const country = await this.countryRepo.findOne({
      where: { id },
    });

    if (!country) {
      throw new BadRequestException("Country not found");
    }

    return await this.countryRepo.remove(country);
  }
}