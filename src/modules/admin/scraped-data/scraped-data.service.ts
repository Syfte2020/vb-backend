// ======================================================
// SERVICE
// src/modules/unregistered/unregistered.service.ts
// ======================================================

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { HttpService } from '@nestjs/axios';

import { firstValueFrom } from 'rxjs';

import { CreateUnregisteredDto } from './dto/create-unregistered.dto';

import { UnregisteredVenue } from './entities/unregistered-venue.entity';
import { UnregisteredGallery } from './entities/unregistered-gallery.entity';
import { UnregisteredTypes } from './entities/unregistered-types.entity';
import { UnregisteredEventTypes } from './entities/unregistered-event-types.entity';

import { StorageService } from 'src/common/storage/storage.service'; //storage

//country

import { Country } from './entities/country.entiity';

//DTO
import { UpdateUnregisteredVenueDto } from './dto/update-unregistered-venue.dto';

@Injectable()
export class UnregisteredService {
  constructor(
    @InjectRepository(UnregisteredVenue)
    private readonly venueRepo: Repository<UnregisteredVenue>,

    @InjectRepository(UnregisteredGallery)
    private readonly galleryRepo: Repository<UnregisteredGallery>,

    @InjectRepository(UnregisteredTypes)
    private readonly typesRepo: Repository<UnregisteredTypes>, 
    
    @InjectRepository(UnregisteredEventTypes)
    private readonly evntTypesRepo: Repository<UnregisteredEventTypes>, 
    
    @InjectRepository(Country)
    private readonly CountryRepo: Repository<Country>,

    private readonly httpService: HttpService,
    private storageService: StorageService,
  ) {}

  // ======================================================
  // SCRAPE GOOGLE DATA 
  // ======================================================

  async scrapeGoogleData(dto: CreateUnregisteredDto) {
    const GOOGLE_API_KEY = process.env.GOOGLE_MAP_API_KEY;

    // ============================================
    // SEARCH QUERY
    // ============================================

    const query = `${dto.eventType} in ${dto.subDistrict || dto.district}, ${dto.state}, ${dto.country}`;

    console.log(query);
    // ============================================
    // GOOGLE TEXT SEARCH
    // ============================================

    const googleUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;

    const response = await firstValueFrom(this.httpService.get(googleUrl));

    const results = response.data.results;

    // ============================================
    // LOOP
    // ============================================

    // for (const item of results) {
    for (const item of results.slice(0, 2)) {
      // CHECK EXISTING

      const exists = await this.venueRepo.findOne({
        where: {
          place_id: item.place_id,
        },
      });

      if (exists) {
        continue;
      }

      // ============================================
      // IMAGES
      // ============================================

      // ======================================================
      // GOOGLE GALLERY IMAGES
      // MAX 10 IMAGES PER VENUE
      // ======================================================

      const galleryImages: string[] = [];

      if (item.photos?.length) {
        // ONLY FIRST 10 IMAGES

        for (const photo of item.photos.slice(0, 10)) {
          // OLD + NEW GOOGLE API SUPPORT

          const photoReference = photo.photo_reference || photo.name;

          if (!photoReference) {
            continue;
          }

          // GOOGLE PHOTO URL

          let imageUrl = '';

          // OLD GOOGLE API

          if (photo.photo_reference) {
            imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photo.photo_reference}&key=${GOOGLE_API_KEY}`;
          }

          // NEW GOOGLE API
          else if (photo.name) {
            imageUrl = `https://places.googleapis.com/v1/${photo.name}/media?maxHeightPx=1200&key=${GOOGLE_API_KEY}`;
          }

          // PUSH IMAGE

          // if (imageUrl) {
          //   galleryImages.push(imageUrl);
          // }
  if (imageUrl) {
  const fileName = `google-${Date.now()}`;

  const s3Url =
    await this.storageService.uploadFromUrl(
      imageUrl,
      fileName,
    );

  galleryImages.push(s3Url);
}
        }
      }

      const venue = this.venueRepo.create({
        name: item.name,

        address: item.formatted_address,

        city: dto.subDistrict || dto.district,

        district: dto.district,

        state: dto.state,

        country: dto.country,

        place_id: item.place_id,

        rating: item.rating || 0,

        types: 1,

        user_ratings_total: item.user_ratings_total || 0,
        lat:item.geometry?.location?.lat,
        lng:item.geometry?.location?.lng,

        // geometry: {
        //   lat: item.geometry?.location?.lat,

        //   lng: item.geometry?.location?.lng,
        // },
      });

      const savedVenue = await this.venueRepo.save(venue);

      console.log(savedVenue.id);

      // ============================================
      // SAVE GALLERY
      // ============================================

      if (galleryImages.length) {
        const galleryRows = galleryImages.map((img) => {
          return this.galleryRepo.create({
            unreg_id: savedVenue.id,

            images: img,
          });
        });

        await this.galleryRepo.save(galleryRows);
      }
    }

    return {
      success: true,

      message: 'Google scraped successfully',
    };
  }

  // ======================================================
  // GET ALL
  // ======================================================

  async findAll(query: any , country:any)  {
    const { category = '', search = '', page = 1, limit = 10 } = query;

    const currentPage = Number(page);
    const take = Number(limit);
    const skip = (currentPage - 1) * take;

    // ============================================
    // QUERY BUILDER
    // ============================================

    const qb = this.venueRepo
      .createQueryBuilder('venue')
      .leftJoinAndSelect('venue.gallery', 'gallery')
      .leftJoinAndSelect('venue.property_types', 'property_types')
      .leftJoinAndSelect('venue.eventTypes', 'eventTypes');

    // ============================================
    // CATEGORY FILTER
    // ============================================

    // if (category) {
    //   qb.andWhere("types.name LIKE :category", {
    //     category: `%${category}%`,
    //   });
    // }

    // ============================================
    // COUNTRY FILTER
    // ============================================

    if (search) {
      qb.andWhere('name LIKE :name', {
        name: `%${search}%`,
      });
    }
    if (country) {
      qb.andWhere('country LIKE :country', {
        country: `%${country}%`,
      });
    }

    // ============================================
    // PAGINATION + ORDER
    // ============================================

    qb.orderBy('venue.id', 'DESC').skip(skip).take(take);

    // ============================================
    // GET DATA
    // ============================================

    const [data, total] = await qb.getManyAndCount();

    // ============================================
    // RESPONSE
    // ============================================

    return {
      success: true,

      pagination: {
        total,
        currentPage,
        limit: take,
        totalPages: Math.ceil(total / take),
      },

      data,
    };
  }

  // ======================================================
  // GET ONE
  // ======================================================

  async findOne(id: number) {
    const venue = await this.venueRepo.findOne({
      where: { id },

      relations: ['gallery', 'property_types', 'eventTypes'],
    });

    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    return venue;
  }

  // ✅ UPDATE
  async update(id: string, dto: UpdateUnregisteredVenueDto, images: any[]) {
    // ============================================
    // FIND PROPERTY
    // ============================================

    const property = await this.venueRepo.findOne({
      where: {
        id: Number(id),
      },
    });

    if (!property) {
      throw new BadRequestException('Property not found');
    }

    // ============================================
    // UPDATE STATUS
    // ============================================

    property.status = Number(dto.status);

    await this.venueRepo.save(property);

    // ============================================
    // PARSE JSON DATA
    // ============================================

    const venueTypes = JSON.parse(dto.venueTypes || '[]');

    const eventTypes = JSON.parse(dto.eventTypes || '[]');

    // ============================================
    // CLEAR OLD TYPES typesRepo  evntTypesRepo
    // ============================================

    await this.typesRepo.delete({
      unreg_id: property.id,
    });

    // ============================================
    // INSERT VENUE TYPES
    // ============================================

    if (venueTypes.length) {
      const typePayload = venueTypes.map((item) => ({
        unreg_id: property.id,
        types_id: item.id,
        type_name: item.name,
      }));

      await this.typesRepo.save(typePayload);
    }

    // ============================================
    // CLEAR OLD EVENT TYPES
    // ============================================

    await this.evntTypesRepo.delete({
      unreg_id: property.id,
    });

    // ============================================
    // INSERT EVENT TYPES
    // ============================================

    if (eventTypes.length) {
      const eventPayload = eventTypes.map((item) => ({
        unreg_id: property.id,
        event_id: item.id
      }));

      await this.evntTypesRepo.save(eventPayload);
    }

    // ============================================
    // CLEAR OLD GALLERY
    // ============================================

    

    // ============================================
    // UPLOAD NEW IMAGES
    // ============================================
if (images?.length) {

  await this.galleryRepo.delete({
      unreg_id: property.id,
    });

  const galleryPayload: any[] = [];

  for (const file of images) {

    // ============================================
    // FILE ALREADY HAS BUFFER
    // ============================================

 const uploadFile = {
  fieldname: "images",
  originalname: file.originalname,
  encoding: "7bit",
  mimetype: file.mimetype,
  buffer: file.buffer,
  size: file.buffer.length,
};
    // ============================================
    // UPLOAD
    // ============================================

    const uploaded =
      await this.storageService.upload(
        uploadFile,
        "unregister/images",
      );

    galleryPayload.push({
      unreg_id: property.id,
      images: uploaded,
    });
  }

  await this.galleryRepo.save(
    galleryPayload,
  );
}
    // ============================================
    // RESPONSE
    // ============================================

    return {
      success: true,
      message: 'Venue updated successfully',
    };
  }

  // ======================================================
  // DELETE
  // ======================================================

  async remove(id: number) {
    const venue = await this.venueRepo.findOne({
      where: { id },
    });

    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    await this.venueRepo.remove(venue);

    return {
      success: true,

      message: 'Deleted successfully',
    };
  }

  // ======================================================
  // COUNTRY LOAD
  // ======================================================

  async all_country() {
    const countries = await this.CountryRepo.find({
      where: {
        status: 0,
      },
      order: {
        id: 'DESC',
      },
    });

    return countries;
  }
}
