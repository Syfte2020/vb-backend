import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not, IsNull } from 'typeorm';
import { VenueParent } from './entities/venue-parent.entity';
import { VenueChild } from './entities/venue-child.entity';
import { VenueChildAmenities } from './entities/venue-child-amenities.entity';
import { VenueGallery } from './entities/venue-gallery.entity';
import { VenueShiftTiming } from './entities/venue-shift-timing.entity';
import { VenueShiftHeader } from './entities/venue-shift-header.entity';
import { VenueGalleryCategory } from './entities/venue-gallery-category.entity';
import { UserRole } from './entities/user-role.entity';
import { UserEntity } from './entities/user.entity';
import { Pricing } from './entities/property_pricing.entity';
import { Destination } from './entities/destination.entity';
import { DestinationPlace } from './entities/destination-place.entity';
import { VenueSeatingStyle } from './entities/venue_seating_styles.entity';

import { StorageService } from 'src/common/storage/storage.service';
import { Readable } from 'stream';

import { ZohoService } from '../integrations/zoho/zoho.service';

import {
  CATEGORY_CONFIG,
  buildPricingArray,
} from '../../helpers/pricing.helper';

import { buildVenueShifts } from '../../helpers/shift.helper';

import axios from 'axios';

@Injectable()
export class ListingService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(VenueParent)
    private readonly parentRepo: Repository<VenueParent>,

    @InjectRepository(VenueChild)
    private readonly childRepo: Repository<VenueChild>,

    @InjectRepository(VenueChildAmenities)
    private readonly amenitiesRepo: Repository<VenueChildAmenities>,

    @InjectRepository(VenueShiftHeader)
    private readonly shiftHeaderRepo: Repository<VenueShiftHeader>,

    @InjectRepository(VenueGallery)
    private readonly venueGalRepo: Repository<VenueGallery>,

    @InjectRepository(VenueGalleryCategory)
    private readonly venueGalCatRepo: Repository<VenueGalleryCategory>,

    @InjectRepository(VenueShiftTiming)
    private readonly venueTimeRepo: Repository<VenueShiftTiming>,

    @InjectRepository(UserRole)
    private readonly UserRoleRepo: Repository<UserRole>,

    @InjectRepository(UserEntity)
    private readonly UserEntityRepo: Repository<UserEntity>,

    @InjectRepository(Pricing)
    private readonly PricingRepo: Repository<Pricing>,

    @InjectRepository(Destination)
    private readonly destinationRepo: Repository<Destination>,

    @InjectRepository(DestinationPlace)
    private readonly destinationPlaceRepo: Repository<DestinationPlace>,

    @InjectRepository(VenueSeatingStyle)
    private readonly venueSeatingStyle: Repository<VenueSeatingStyle>,

    private storageService: StorageService,
    private zohoService: ZohoService,
  ) {}

  /* =========================================================
     MAIN CREATE LISTING API
    ========================================================= */
  async create(data: {
    body: any;
    images: any;
    coverImage: any;
    bannerImage: any;
    user: any;
  }) {
    const userId = data.user?.id;

    const mode =
      data.body.mode === undefined || data.body.mode === 'undefined'
        ? 'venue'
        : data.body.mode;
    /* =========================================================
                           User Updte
     ========================================================= */

    const vendorId = await this.generateVendorId();
    await this.UserEntityRepo.update(
      { id: userId },
      {
        vendor_id: vendorId,
      },
    );

    /* =========================================================
                           vendor Create
     ========================================================= */
    const userCat = this.UserRoleRepo.create({
      userId: userId,
      roleId: 2,
      autoRole: Number(0),

      maskData: Number(0),
    });
    await this.UserRoleRepo.save(userCat);
    /* =========================================================
                           Prent VENUES
     ========================================================= */
    // check here parent_venue_id
    // const parentVenue = this.parentRepo.create({
    //   venueName: data.body.title,
    //   venueCompanyName: data.body.title,
    //   parentAutoNo: data.body.title,
    //   venueAddress: data.body.address,
    //   venueState: data.body.state || '',
    //   venueCity: data.body.city,
    //   venuePincode: data.body.pincode || '',
    //   venueCountry: data.body.country,

    //   district: '',
    //   rating: 0,
    //   lat: Number(data.body.lat || 0),
    //   lng: Number(data.body.lng || 0),
    //   reviews: 1,
    //   placeId: '',
    //   createdBy: userId,
    //   userRatingsTotal: 1,
    //   publishStatus: '0',
    //   propetyCategory: data.body.category,
    // });
    // const savedVenue = await this.parentRepo.save(parentVenue);
    let savedVenue;
    let Child_count = 1;

    if (data.body.parent_venue_id) {
      const existingVenue = await this.parentRepo.findOne({
        where: {
          parent_venue_id: data.body.parent_venue_id,
        },
      });
      Child_count = existingVenue ? Number(existingVenue.child_count) : 1;

      if (existingVenue) {
        Object.assign(existingVenue, {
          venueAddress: data.body.address,
          venueState: data.body.state || '',
          venueCity: data.body.city,
          venuePincode: data.body.pincode || '',
          venueCountry: data.body.country === 'IN' ? '2' : '3',
          lat: Number(data.body.lat || 0),
          lng: Number(data.body.lng || 0),
          propetyCategory: data.body.category,
        });

        savedVenue = await this.parentRepo.save(existingVenue);
      }
    }

    // const [rows] = await this.dataSource.query(
    //   `SELECT * FROM users WHERE id = ? LIMIT 1`,
    //   [userId],
    // );

    // const user = rows;

    const [rows] = await this.dataSource.query(
  `SELECT * FROM users WHERE id = ? LIMIT 1`,
  [userId],
);

const user = rows;

if (user) {
  const updates: string[] = [];
  const values: any[] = [];

  if (!user.email && data.body.contact_email) {
    updates.push(`email = ?`);
    values.push(data.body.contact_email);
  }

  if (!user.phone && data.body.contact_phone) {
    updates.push(`phone = ?`);
    values.push(data.body.contact_phone);
  }

  if (updates.length > 0) {
    values.push(userId);

    await this.dataSource.query(
      `UPDATE users
       SET ${updates.join(", ")}
       WHERE id = ?`,
      values,
    );
  }
}

    // await this.syncDestination(data.body.city); conatct_person email phone

    if (!savedVenue) {
      const parentVenue = this.parentRepo.create({
        venueName: data.body.title,
        venueCompanyName: data.body.title,
        parentAutoNo: String(0),
        venueAddress: data.body.address,
        conatct_person: user.name,
        phone: data.body.contact_phone,
        email: data.body.contact_email,
        venueState: data.body.state || '',
        venueCity: data.body.city,
        venuePincode: data.body.pincode || '',
        venueCountry: data.body.country === 'IN' ? '2' : '3',
        district: '',
        rating: 0,
        lat: Number(data.body.lat || 0),
        lng: Number(data.body.lng || 0),
        reviews: 1,
        placeId: '',
        createdBy: userId,
        userRatingsTotal: 1,
        publishStatus: '0',
        propetyCategory: data.body.category,
        child_count: 1,
      });

      savedVenue = await this.parentRepo.save(parentVenue);
    }

    /* =========================================================
                           CHILD VENUES
    ========================================================= */

    const capacitySetting =
      typeof data.body.capacity_setting === 'string'
        ? JSON.parse(data.body.capacity_setting)
        : data.body.capacity_setting;

    let categoryData = {};
    const pricing = data.body.pricing || {};

    if (data.body.category == 'venue') {
      categoryData = {
        uShape: capacitySetting?.seatingStyles?.ushape?.capacity || 0,
        banquetRound: capacitySetting?.seatingStyles?.banquet?.capacity || 0,
        cocktailRound: capacitySetting?.seatingStyles?.cocktail?.capacity || 0,
        theater: capacitySetting?.seatingStyles?.theatre?.capacity || 0,
        classroom: capacitySetting?.seatingStyles?.classroom?.capacity || 0,
        boardroom: capacitySetting?.seatingStyles?.boardroom?.capacity || 0,
        eShape: capacitySetting?.seatingStyles?.e_shape?.capacity || 0,
        hollowSquare:
          capacitySetting?.seatingStyles?.hollow_square?.capacity || 0,
        perimeterSeating:
          capacitySetting?.seatingStyles?.perimeter_seating?.capacity || 0,
        royalConf: capacitySetting?.seatingStyles?.royal_conf?.capacity || 0,
        tShape: capacitySetting?.seatingStyles?.t_shape?.capacity || 0,
        talkShow: capacitySetting?.seatingStyles?.cabaret?.capacity || 0,
        guestRooms: Number(data.body.capacity_maxGuests || 0),
      };

      // ============================================
      // INSERT VENUE SEATING STYLES
      // ============================================
    } else if (data.body.category == 'farmstay') {
      categoryData = {
        checkIn: pricing?.checkIn || '3:00 PM',
        checkOut: pricing?.checkOut || '11:00 AM',
      };
    } else if (data.body.category == 'studio') {
      categoryData = {
        banquetRound: capacitySetting?.sizeSqft || 0,
        cocktailRound: capacitySetting?.maxOccupancy || 0,
        guestRooms: capacitySetting?.maxOccupancy || 0,
      };
    } else if (data.body.category == 'workspace') {
      categoryData = {
        guestRooms: capacitySetting?.seatingCapacity || 0,
        banquetRound: capacitySetting?.sizeSqft || 0,
      };
    } else if (data.body.category == 'rental') {
      categoryData = {
        guestRooms: capacitySetting?.maxGuests || 0,
        banquetRound: capacitySetting?.bedrooms || 0,
        cocktailRound: capacitySetting?.bathrooms || 0,
      };
    } else if (data.body.category == 'experience') {
      categoryData = {
        guestRooms: capacitySetting?.maxGuests || 0,
        banquetRound: capacitySetting?.groupSize || 0,
        cocktailRound: capacitySetting?.duration || 0,
      };
    }
    const ChildVenue = this.childRepo.create({
      parentVenueId: savedVenue.parent_venue_id,
      venueCategoryId: data.body.subcategory,
      createdBy: userId,
      // moreInfo: data.body.description,
      childVenueName: data.body.title,
      minGuest: Number(data.body.capacity_minGuests || 0),

      totalMeetingSpace: data.body.totalMeetingSpace,
      moreInfo: data.body.description,
      childVenueDetails: data.body.childVenueDetails,
      ...categoryData,
      venueMode: mode,
      publishStatus: 0,
    });
    const savedChildVenue = await this.childRepo.save(ChildVenue);

    if (data.body.category == 'farmstay') {
      const FarmStayCapacity =
        typeof data.body.capacity_setting === 'string'
          ? JSON.parse(data.body.capacity_setting)
          : data.body.capacity_setting;

      await this.dataSource.query(
        `INSERT INTO venue_attributes (venue_id, category_id,max_adults,max_kids,
          pets_allowed,room_combined,room_types,property_area,property_area_type,bathroom_facilities,bed_types,created_at,updated_at)
         VALUES (?, ? , ? ,? ,? ,? , ? , ? , ? ,?, ? , NOW() , NOW())`,
        [
          savedChildVenue.child_venue_id,
          2,
          FarmStayCapacity.maxAdults,
          FarmStayCapacity.maxKids,
          FarmStayCapacity.pet_allowed == 'yes' ? 1 : 0,
          FarmStayCapacity.roomCombination == 'yes' ? 1 : 0,
          FarmStayCapacity.propertyArea,
          FarmStayCapacity.propertyAreaUnit,
          JSON.stringify(FarmStayCapacity.roomTypes),
          JSON.stringify(FarmStayCapacity.bathroomFacilities),
          JSON.stringify(FarmStayCapacity.bedTypes),
        ],
      );
    }

    // ============================================
    // INSERT VENUE SEATING STYLES
    // ============================================

    if (data.body.category === 'venue') {
      const seatingStyles = [
        {
          seating_type: 'ushape',
          capacity: Number(
            capacitySetting?.seatingStyles?.ushape?.capacity || 0,
          ),
        },
        {
          seating_type: 'banquet',
          capacity: Number(
            capacitySetting?.seatingStyles?.banquet?.capacity || 0,
          ),
        },
        {
          seating_type: 'cocktail',
          capacity: Number(
            capacitySetting?.seatingStyles?.cocktail?.capacity || 0,
          ),
        },
        {
          seating_type: 'theatre',
          capacity: Number(
            capacitySetting?.seatingStyles?.theatre?.capacity || 0,
          ),
        },
        {
          seating_type: 'classroom',
          capacity: Number(
            capacitySetting?.seatingStyles?.classroom?.capacity || 0,
          ),
        },
        {
          seating_type: 'boardroom',
          capacity: Number(
            capacitySetting?.seatingStyles?.boardroom?.capacity || 0,
          ),
        },
        {
          seating_type: 'e_shape',
          capacity: Number(
            capacitySetting?.seatingStyles?.e_shape?.capacity || 0,
          ),
        },
        {
          seating_type: 'hollow_square',
          capacity: Number(
            capacitySetting?.seatingStyles?.hollow_square?.capacity || 0,
          ),
        },
        {
          seating_type: 'perimeter_seating',
          capacity: Number(
            capacitySetting?.seatingStyles?.perimeter_seating?.capacity || 0,
          ),
        },
        {
          seating_type: 'royal_conf',
          capacity: Number(
            capacitySetting?.seatingStyles?.royal_conf?.capacity || 0,
          ),
        },
        {
          seating_type: 't_shape',
          capacity: Number(
            capacitySetting?.seatingStyles?.t_shape?.capacity || 0,
          ),
        },
        {
          seating_type: 'cabaret',
          capacity: Number(
            capacitySetting?.seatingStyles?.cabaret?.capacity || 0,
          ),
        },
      ]
        .filter((style) => style.capacity > 0)
        .map((style, index) => ({
          venueId: savedChildVenue.child_venue_id,
          seatingType: style.seating_type,
          isEnabled: 1,
          capacity: style.capacity,
          sortOrder: index + 1,
        }));

      if (seatingStyles.length) {
        await this.venueSeatingStyle.insert(seatingStyles);
      }
    }

    /* =========================================================
                           Tags 
     ========================================================= */
    await this.dataSource.query(
      `INSERT INTO venue_tags (child_venue_id, venue_cat_id)
         VALUES (?, ?)`,
      [savedChildVenue.child_venue_id, data.body.subcategory],
    );

    /* =========================================================
                           Amenties
     ========================================================= */
    const amenities = (data.body.amenities || []).map((amenityId) => {
      return this.amenitiesRepo.create({
        amenitiesId: amenityId,

        createdBy: userId,

        childVenueId: savedChildVenue.child_venue_id,
      });
    });
    await this.amenitiesRepo.save(amenities);
    /* =========================================================
                           Gleery Ctgory
     ========================================================= */
    const gcategory = this.venueGalCatRepo.create({
      name: 'additonal images',
      description: 'additonal images Description',
      vendorId: userId,
      childId: savedChildVenue.child_venue_id,
      createdBy: userId,
    });
    const savedgCategoryVenue = await this.venueGalCatRepo.save(gcategory);
    /* =========================================================
                           gllery
     ========================================================= */
    // COVER IMAGE
    // if (data.coverImage) {
    //   const uploadFile = {
    //     fieldname: 'cover_image',
    //     originalname: data.coverImage.originalname,
    //     encoding: '7bit',
    //     mimetype: data.coverImage.mimetype,
    //     buffer: data.coverImage.buffer,
    //     size: data.coverImage.buffer.length,
    //   };
    //   const uploaded = await this.storageService.upload(
    //     uploadFile,
    //     'venues/cover',
    //   );
    //   await this.venueGalRepo.save({
    //     childVenueId: savedChildVenue.child_venue_id,
    //     attachment: uploaded,
    //     name: '',
    //     categoryId: savedgCategoryVenue.id,
    //     description: '',
    //     imageType: '1', // COVER
    //     fileExtension: 'png',
    //   });
    // }
    // BANNER IMAGE
    // if (data.bannerImage) {
    //   const uploadFile = {
    //     fieldname: 'banner_image',
    //     originalname: data.bannerImage.originalname,
    //     encoding: '7bit',
    //     mimetype: data.bannerImage.mimetype,
    //     buffer: data.bannerImage.buffer,
    //     size: data.bannerImage.buffer.length,
    //   };

    //   const uploaded = await this.storageService.upload(
    //     uploadFile,
    //     'venues/banner',
    //   );
    //   await this.venueGalRepo.save({
    //     childVenueId: savedChildVenue.child_venue_id,
    //     attachment: uploaded,
    //     name: '',
    //     categoryId: savedgCategoryVenue.id,
    //     description: '',
    //     imageType: '2', // BANNER
    //     fileExtension: 'png',
    //   });
    // }
    // GALLERY IMAGES
    if (data.images?.length) {
      const galleryPayload: any[] = [];

      // for (const file of data.images) {
      for (const [index, file] of data.images.entries()) {
        const uploadFile = {
          fieldname: 'images',
          originalname: file.originalname,
          encoding: '7bit',
          mimetype: file.mimetype,
          buffer: file.buffer,
          size: file.buffer.length,
        };

        const uploaded = await this.storageService.upload(
          uploadFile,
          'venues/gallery',
        );

        galleryPayload.push({
          childVenueId: savedChildVenue.child_venue_id,
          attachment: uploaded,
          name: '',
          categoryId: savedgCategoryVenue.id,
          description: '',
          imageType: index === 0 ? '1' : '3',
          fileExtension: 'png',
        });
      }

      await this.venueGalRepo.save(galleryPayload);
    }
    /* =========================================================
                          Shift Heder
     ========================================================= */

    // const category = data.body.category;
    // const config = CATEGORY_CONFIG[category];
    // if (config?.type === 'shift') {
    //   const { shiftHeaders, venueTimes } = buildVenueShifts(
    //     pricing,
    //     String(savedChildVenue.child_venue_id),
    //   );
    //   await this.shiftHeaderRepo.save(shiftHeaders);
    //   await this.venueTimeRepo.save(venueTimes);
    // } else if (config?.type === 'pricing') {
    //   const pricingArray = buildPricingArray(
    //     category,
    //     pricing,
    //     String(savedChildVenue.child_venue_id),
    //   );
    //   await this.PricingRepo.save(pricingArray);
    // }
    const category = data.body.category;
    const config = CATEGORY_CONFIG[category];

    if (config?.type === 'shift') {
      const childVenueId = String(savedChildVenue.child_venue_id);

      const { shiftHeaders, venueTimes , securitySettings} = buildVenueShifts(
        pricing,
        childVenueId,
      );

      // Insert ALL shifts
      await this.shiftHeaderRepo.save(shiftHeaders);
      await this.venueTimeRepo.save(venueTimes);

       await this.dataSource.query(
          `
      INSERT INTO venue_child_settings
      (
        child_id,
        \`group\`,
        \`key\`,
        value
      )
      VALUES (?, ?, ?, ?)

      ON DUPLICATE KEY UPDATE
        value = VALUES(value)
      `,
          [childVenueId, 'deposits', 'security', 'true'],
        );

       await this.dataSource.query(
          `
      INSERT INTO venue_child_settings
      (
        child_id,
        \`group\`,
        \`key\`,
        value
      )
      VALUES (?, ?, ?, ?)

      ON DUPLICATE KEY UPDATE
        value = VALUES(value)
      `,
          [childVenueId, 'publication', 'enquire', 'true'],
        );
      

      for (const setting of securitySettings) {
        await this.dataSource.query(
          `
      INSERT INTO venue_child_settings
      (
        child_id,
        \`group\`,
        \`key\`,
        value
      )
      VALUES (?, ?, ?, ?)

      ON DUPLICATE KEY UPDATE
        value = VALUES(value)
      `,
          [setting.childId, setting.group, setting.key, setting.value],
        );
      }

      // Enable only shifts where amount is entered
      // for (const shift of shiftHeaders) {
      //   const amount = Number(shift.amount || 0);

      //   await this.shiftHeaderRepo.update(
      //     { id: shift.id },
      //     {
      //       publish: amount > 0 ? 1 : 0,
      //     },
      //   );
      // }
    }
    // else if (config?.type === 'pricing') {
    //   const pricingArray = buildPricingArray(
    //     category,
    //     pricing,
    //     String(savedChildVenue.child_venue_id),

    //   );

    //   await this.PricingRepo.save(pricingArray);
    // }
    else if (config?.type === 'pricing') {
      const childVenueId = String(savedChildVenue.child_venue_id);

      const { pricingArray, securitySettings } = buildPricingArray(
        category,
        pricing,
        childVenueId,
      );

      await this.PricingRepo.save(pricingArray);

      console.log('-------------------------------------');
      console.log(securitySettings);
      console.log('-------------------------------------');

      for (const setting of securitySettings) {
        await this.dataSource.query(
          `
      INSERT INTO venue_child_settings
      (
        child_id,
        \`group\`,
        \`key\`,
        value
      )
      VALUES (?, ?, ?, ?)

      ON DUPLICATE KEY UPDATE
        value = VALUES(value)
      `,
          [setting.childId, setting.group, setting.key, setting.value],
        );
      }
    }
    /* =========================================================
                           shift Timing
     ========================================================= */

    /* =========================================================
                        Settings
     ========================================================= */

    // const sd = data.body?.pricing?.deposit;
    // if (sd) {
    //   this.dataSource.query(
    //     `
    //     INSERT INTO venue_child_settings
    //     (
    //       child_id,
    //       group,
    //       key,
    //       value
    //     )

    //     VALUES (?, ?, ?, ?)

    //     ON DUPLICATE KEY UPDATE
    //     value = VALUES(value)
    //     `,
    //     [savedChildVenue.child_venue_id, 'deposits', 'secAmt', sd],
    //   );
    // }
    const sd = Number(data.body?.security_deposit || 0);

    console.log('-----------------security-----------');
    console.log(sd);
    console.log(data.body?.pricing);

    if (sd > 0) {
      await this.dataSource.query(
        `
    INSERT INTO venue_child_settings
    (
      child_id,
      \`group\`,
      \`key\`,
      value
    )
    VALUES
      (?, ?, ?, ?),
      (?, ?, ?, ?)

    ON DUPLICATE KEY UPDATE
      value = VALUES(value)
    `,
        [
          savedChildVenue.child_venue_id,
          'deposits',
          'secAmt',
          sd,

          savedChildVenue.child_venue_id,
          'deposits',
          'security',
          'true',
        ],
      );
    }

    await this.dataSource.query(
      `
    INSERT INTO venue_child_settings
    (
      child_id,
      \`group\`,
      \`key\`,
      value
    )
    VALUES
      (?, ?, ?, ?),
      (?, ?, ?, ?)

    ON DUPLICATE KEY UPDATE
      value = VALUES(value)
    `,
      [
        savedChildVenue.child_venue_id,
        'publication',
        'pricingModel',
        mode,

        savedChildVenue.child_venue_id,
        'publication',
        'status',
        'draft',
      ],
    );
    //   const yourPlans = await this.dataSource.query(
    //     `SELECT id
    //  FROM plans
    //  WHERE max_venue = ?
    //    AND recomended = 1
    //    AND status = 1`,
    //     [Child_count],
    //   );

    //   for (const plan of yourPlans) {
    //     await this.dataSource.query(
    //       `INSERT INTO vendor_options (
    //     parent_id,
    //     option_type,
    //     option_key,
    //     created_at
    //   ) VALUES (?, ?, ?, NOW())`,
    //       [savedVenue.parent_venue_id, 'plans', plan.id],
    //     );
    //   }

    return {
      success: true,
      data,
    };
  }

  private async generateVendorId(): Promise<string> {
    const lastVendor = await this.UserEntityRepo.findOne({
      where: {
        vendor_id: Not(IsNull()),
      },
      order: {
        id: 'DESC',
      },
      select: ['vendor_id'],
    });

    const next = lastVendor?.vendor_id
      ? parseInt(lastVendor.vendor_id.replace('V', ''), 10) + 1
      : 1;

    return `V${next.toString().padStart(5, '0')}`;
  }
  4;
  async create_parent(id: any, body: any, image: any, Country: any) {
    let uploaded = '';
    if (image) {
      const uploadFile = {
        fieldname: 'logo',
        originalname: image.originalname || image.filename,
        encoding: '7bit',
        mimetype: image.mimetype,
        buffer: image.buffer,
      };
      uploaded = await this.storageService.upload(
        uploadFile,
        'venues/parent/logo',
      );
    }

    const parentVenue = this.parentRepo.create({
      venueName: body.property_name,
      venueCompanyName: body.property_name,
      logo: uploaded,
      child_count: body.child_venue_count,
      conatct_person: body.contact_person,
      email: body.email || '',
      phone: body.phone,
      property_size: body.property_size || '', //size_unit
      size_unit: body.size_unit || '', //size_unit
      build_year: body.built_year,
      opertaion_year: body.operating_since,
      aboutVenues: body.description,
      propetyCategory: body.category,
      venueCountry: Country,
      createdBy: id,
    });
    const savedVenue = await this.parentRepo.save(parentVenue);

     const [rows] = await this.dataSource.query(
  `SELECT * FROM users WHERE id = ? LIMIT 1`,
  [id],
);

const user = rows;

if (user) {
  const updates: string[] = [];
  const values: any[] = [];

  if (!user.email && body.email) {
    updates.push(`email = ?`);
    values.push(body.email);
  }

  if (!user.phone && body.phone) {
    updates.push(`phone = ?`);
    values.push(body.phone);
  }

  if (updates.length > 0) {
    values.push(id);

    await this.dataSource.query(
      `UPDATE users
       SET ${updates.join(", ")}
       WHERE id = ?`,
      values,
    );
  }
}

    return savedVenue.parent_venue_id;
  }

  async parent_last_create_id(id: any, type: any, Country: any) {
    const parent = await this.dataSource.query(
      `
    SELECT parent_venue_id,child_count,email,conatct_person as name, phone,lat,lng,venue_address as address , venue_city as city , venue_state as state , venue_pincode as pincode
    FROM venue_parent
    WHERE created_by = ?
      AND (propety_category = ? OR propety_category IS NULL OR propety_category = '')
      AND venue_country = ? 
    ORDER BY parent_venue_id DESC
    LIMIT 1
    `,
      [id, type, Country],
    );

    return {
      parent_id: parent?.[0]?.parent_venue_id ?? null,
      child_count: parent?.[0]?.child_count ?? 1,
      email: parent?.[0]?.email ?? null,
      name: parent?.[0]?.name ?? null,
      phone: parent?.[0]?.phone ?? null,
      lat: parent?.[0]?.lat ?? null,
      lng: parent?.[0]?.lng ?? null,
      address: parent?.[0]?.address ?? null,
      city: parent?.[0]?.city ?? null,
      state: parent?.[0]?.state ?? null,
      pincode: parent?.[0]?.pincode ?? null, //venue_address as address , venue_city as city , venue_state as state , venue_pincode as pincode
    };
  }

  async parent_of_category(id: any, type: any, country: any) {
    const parent = await this.dataSource.query(
      `
    SELECT *
    FROM venue_parent
    WHERE created_by = ? AND propety_category = ? AND venue_country = ?
    LIMIT 1
    `,
      [id, type, country],
    );

    return parent;
  }

  async listing_sub_check(id: any, type: any, country: any) {
    const singular = type.endsWith('s') ? type.slice(0, -1) : type;

    const [categorys] = await this.dataSource.query(
      `SELECT id FROM category WHERE name = ? limit 1`,
      [singular],
    );

    const parent = await this.dataSource.query(
      `
    SELECT *
    FROM user_subscriptions
    WHERE user_id = ? AND category_id = ? AND country_id = ?
    LIMIT 1
    `,
      [id, categorys.id, country],
    );

    return parent;
  }

  async child_of_category(id: any, type: any, Country: any) {
    const singular = type.endsWith('s') ? type.slice(0, -1) : type;

    const [categorys] = await this.dataSource.query(
      `SELECT id FROM category WHERE name = ? limit 1`,
      [singular],
    );

    const parent = await this.dataSource.query(
      `
    SELECT *
    FROM venue_child 
    LEFT JOIN venue_parent ON venue_parent.parent_venue_id = venue_child.parent_venue_id
    WHERE venue_child.created_by = ? AND propety_category = ? AND venue_country = ?
    `,
      [id, singular, Country],
    );

    return parent;
  }

  // Sync Destination
  // async syncDestination(city: string) {
  //   const GOOGLE_API_KEY = process.env.GOOGLE_MAP_API_KEY;
  //   const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
  //     city,
  //   )}&key=${GOOGLE_API_KEY}`;

  //   const { data } = await axios.get(url);

  //   if (!data.results?.length) {
  //     throw new NotFoundException('Destination not found');
  //   }

  //   const item = data.results[0];

  //   let destination = await this.destinationRepo.findOne({
  //     where: {
  //       google_place_id: item.place_id,
  //     },
  //   });

  //   if (!destination) {
  //     destination = await this.destinationRepo.save({
  //       google_place_id: item.place_id,
  //       name: item.name,
  //       slug: item.name
  //         .toLowerCase()
  //         .replace(/\s+/g, '-')
  //         .replace(/[^\w-]/g, ''),
  //       type: 'town',
  //       formatted_address: item.formatted_address,
  //       state: '',
  //       district: '',
  //       country: '',
  //       latitude: item.geometry.location.lat,
  //       longitude: item.geometry.location.lng,
  //       image: undefined,
  //       popularity_score: item.rating || 0,
  //       status: 1,
  //     });
  //   }
  //   await this.syncDestinationPlaces(destination!.id!);

  //   return destination;
  // }
  async syncDestination(location: string) {
    const { states, country } = this.extractStateCountry(location);

    const GOOGLE_API_KEY = process.env.GOOGLE_MAP_API_KEY;
    // Check existing data first
    const existing = await this.dataSource.query(
      `
    SELECT
      id, google_place_id, name, slug, type, formatted_address,
      district, state, country, latitude, longitude, image,
      popularity_score, status
    FROM destinations
    WHERE
      status = 1
      AND (LOWER(state) = LOWER(?) OR LOWER(district) = LOWER(?))
    ORDER BY popularity_score DESC
    LIMIT 6
    `,
      [states, states],
    );

    // Already imported
    if (existing.length >= 6) {
      return existing;
    }

    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      `best places to visit in ${states}`,
    )}&key=${GOOGLE_API_KEY}`;

    const { data } = await axios.get(searchUrl);

    if (!data.results?.length) {
      throw new NotFoundException('Destination not found');
    }

    // Rank ALL qualifying places first (don't slice yet — slicing too early
    // can throw away unique cities if top-rated results repeat the same city)
    const rankedPlaces = data.results
      .filter((x) => x.rating >= 4.0)
      .sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return (b.user_ratings_total || 0) - (a.user_ratings_total || 0);
      });

    const visitedCities = new Set<string>();
    const destinations: any[] = [];

    for (const item of rankedPlaces) {
      if (destinations.length >= 6) break;

      const {
        city,
        state,
        country: placeCountry,
      } = await this.getPlaceCityStateCountry(item.place_id);

      // Skip entries with no resolvable city
      if (!city) continue;

      const cityKey = city.toLowerCase().trim();

      // Skip duplicate cities — since rankedPlaces is sorted by rating desc,
      // the first time we see a city is guaranteed to be its highest-rated entry
      if (visitedCities.has(cityKey)) continue;
      visitedCities.add(cityKey);

      const imageUrl = await this.getOrUploadPlaceImage(item);

      const payload = {
        google_place_id: item.place_id,
        name: item.name,
        slug: this.slugify(item.name),
        type: 'tourist_place',
        formatted_address: item.formatted_address,
        district: city,
        state,
        country: placeCountry,
        latitude: item.geometry.location.lat,
        longitude: item.geometry.location.lng,
        image: imageUrl,
        popularity_score: item.rating || 0,
        status: 1,
      };

      let destination = await this.destinationRepo.findOne({
        where: { google_place_id: item.place_id },
      });

      if (!destination) {
        destination = this.destinationRepo.create(payload);
      } else {
        Object.assign(destination, payload);
      }

      await this.destinationRepo.save(destination);
      destinations.push(destination);
    }

    return destinations;
  }

  // ---------- Standard helper functions ----------

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '');
  }

  private async getPlaceCityStateCountry(placeId: string) {
    const apiKey = process.env.GOOGLE_MAP_API_KEY;
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=address_components&key=${apiKey}`;

    const { data: details } = await axios.get(detailsUrl);

    let city = '';
    let state = '';
    let country = '';

    const components = details.result?.address_components || [];

    for (const component of components) {
      if (component.types.includes('locality')) {
        city = component.long_name;
      }

      if (!city && component.types.includes('administrative_area_level_2')) {
        city = component.long_name;
      }

      if (component.types.includes('administrative_area_level_1')) {
        state = component.long_name;
      }

      if (component.types.includes('country')) {
        country = component.long_name;
      }
    }

    return { city, state, country };
  }

  private async getOrUploadPlaceImage(item: any) {
    const apiKey = process.env.GOOGLE_MAP_API_KEY;
    if (!item.photos?.length) return '';

    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${item.photos[0].photo_reference}&key=${apiKey}`;

    const photoResponse = await axios.get(photoUrl, {
      responseType: 'arraybuffer',
    });

    const uploadFile = {
      originalname: `${item.place_id}.jpg`,
      mimetype: 'image/jpeg',
      buffer: Buffer.from(photoResponse.data),
      stream: Readable.from(photoResponse.data),
    } as any;

    return this.storageService.upload(uploadFile, 'destinations/cover');
  }
  async syncDestinationPlaces(destinationId: number) {
    const GOOGLE_API_KEY = process.env.GOOGLE_MAP_API_KEY;

    const destination = await this.destinationRepo.findOne({
      where: { id: destinationId },
    });

    if (!destination) {
      throw new NotFoundException('Destination not found');
    }

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${destination.latitude},${destination.longitude}&radius=10000&type=tourist_attraction&key=${GOOGLE_API_KEY}`;

    const { data } = await axios.get(url);

    let places = data.results || [];

    // Sort by rating and total ratings
    places.sort((a, b) => {
      const ratingDiff = (b.rating || 0) - (a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;

      return (b.user_ratings_total || 0) - (a.user_ratings_total || 0);
    });

    // Find one Hindu temple
    const hinduTemple = places.find((p) => p.types?.includes('hindu_temple'));

    // Remove temple from list to avoid duplicates
    places = places.filter((p) => p.place_id !== hinduTemple?.place_id);

    // Take top tourist places
    const selectedPlaces = hinduTemple
      ? [hinduTemple, ...places.slice(0, 5)] // 1 temple + 5 attractions
      : places.slice(0, 6); // No temple found

    for (const place of selectedPlaces) {
      const exists = await this.destinationPlaceRepo.findOne({
        where: {
          google_place_id: place.place_id,
        },
      });

      if (exists) continue;

      await this.destinationPlaceRepo.save({
        destination_id: destination.id,
        google_place_id: place.place_id,
        name: place.name,
        category: place.types?.[0] ?? null,
        formatted_address: place.vicinity,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        rating: place.rating ?? 0,
        total_ratings: place.user_ratings_total ?? 0,
        image: place.photos?.length
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${place.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
          : undefined,
        opening_hours: place.opening_hours
          ? JSON.stringify(place.opening_hours)
          : undefined,
        google_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
        status: 1,
      });
    }

    return true;
  }

  private extractStateCountry(address: string) {
    const parts = address
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const states =
      parts.length >= 2
        ? parts[parts.length - 2].replace(/\d+/g, '').trim()
        : '';

    return {
      states,
      country: parts.length >= 1 ? parts[parts.length - 1] : '',
    };
  }

  // async createTest ()
  // {
  //    // Send vendor to Zoho CRM as a Lead
  //   // return await this.zohoService.createBooking({
  //   // bookingNo: 'VB-100001',
  //   //   customerName: 'Kenth vas',
  //   //   amount: 25000,
  //   //   bookingDate: '2026-08-15',
  //   //   stage: 'Booked',
  //   //   description: 'Wedding Hall Booking - Test',
  //   // });

  // //  return await this.zohoService.createBooksCustomer({
  // //   customerName: 'Shawns Lanish',
  // //   email: 'shawns.test@gmail.com',
  // //   phone: '9876543211',
  // //   mobile: '9876543211',
  // // });

  // return await this.zohoService.createBooking({
  //     customerId: "3975444000000047002", // Replace with an actual customer_id from Zoho Books
  //     bookingNo: "VB-100001",
  //     itemId: "3975444000000033267", // Replace with an actual item_id from Zoho Books
  //     quantity: 1,
  //     rate: 250,
  //   });

  // }

  async createTest() {
    // without tax
    return await this.zohoService.completeBookingZoho({
      customer: {
        name: 'shawn lanish dsouza',
        email: 'vb.develop2@gmail.com',
        phone: '9876543210',
      },
      items: [
        { itemId: '3975444000000033267', quantity: 1, rate: 99 }, // Convenience Fees
        { itemId: '3975444000000033258', quantity: 1, rate: 2000 }, // Farmstay Commission
        { itemId: '3975444000000033239', quantity: 1, rate: 1500 }, // Venue Commission
        { itemId: '3975444000000033229', quantity: 1, rate: 298 }, // Venue Subscription
      ],
      booking: {
        bookingNo: 'BOOK-1005',
        bookingDate: '2026-07-31',
        notes: 'Test booking',
      },
      payment: {
        amount: 5001,
        mode: 'cash',
        date: '2026-07-28',
      },
    });
  }

  async allFilter(category: any, country: any) {
    const singular = category.endsWith('s') ? category.slice(0, -1) : category;

    const [categorys] = await this.dataSource.query(
      `SELECT id FROM category WHERE name = ? limit 1`,
      [singular],
    );

    const event_types = await this.dataSource.query(
      `SELECT * FROM booking_event_types`,
    );

    const venue_categories = await this.dataSource.query(
      `SELECT * FROM venue_categories WHERE category_id = ? `,
      [categorys.id],
    );

    const categoryId = Number(categorys?.id || 0);

    const amenities = await this.dataSource.query(
      `
    SELECT *
    FROM amenities
    WHERE category_id = 0
       OR category_id = ?
  `,
      [categoryId],
    );

    return {
      event_types: event_types,
      venue_categories: venue_categories,
      amenities: amenities,
    };
  }
}
