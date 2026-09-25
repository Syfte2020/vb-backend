import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Currency } from "./entities/currency.entity";
import { CreateCurrencyDto } from "./dto/create-currency.dto";
import { UpdateCurrencyDto } from "./dto/update-currency.dto";




@Injectable()
export class CurrencyService {

  constructor(
    @InjectRepository(Currency)
    private currencyRepo: Repository<Currency>,
  ) {}

  /* CREATE */
  async create(dto: CreateCurrencyDto, userId: string) {

    const exists = await this.currencyRepo.findOne({
      where: { code: dto.code },
    });

    if (exists) {
      throw new BadRequestException("Currency already exists");
    }

    const currency = this.currencyRepo.create({
      ...dto,
      //created_by: userId,
    });

    return await this.currencyRepo.save(currency);
  }

  /* FIND ALL (WITH SEARCH + PAGINATION) */
  async findAll(query: any) {

    const { page = 1, limit = 10, search = "" } = query;

    const qb = this.currencyRepo.createQueryBuilder("currency");

    if (search) {
      qb.where("currency.name LIKE :search OR currency.code LIKE :search", {
        search: `%${search}%`,
      });
    }

    qb.orderBy("currency.created_at", "DESC")
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
    return await this.currencyRepo.findOne({ where: { id } });
  }

  /* UPDATE */
  async update(id: string, dto: UpdateCurrencyDto) {

    const currency = await this.currencyRepo.findOne({
      where: { id },
    });

    if (!currency) {
      throw new BadRequestException("Currency not found");
    }

    Object.assign(currency, dto);

    return await this.currencyRepo.save(currency);
  }

  /* DELETE */
  async remove(id: string) {

    const currency = await this.currencyRepo.findOne({
      where: { id },
    });

    if (!currency) {
      throw new BadRequestException("Currency not found");
    }

    return await this.currencyRepo.remove(currency);
  }
}