import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from "@nestjs/core";

import { ActivityLogInterceptor } from "./modules/admin/activity-logs/interceptors/activity-log.interceptor";

/* MODULES */
import { HomeModule } from './modules/home/home.module';
import { CategoryModule } from './modules/category/category.module';
import { VenueModule } from './modules/venue/venue.module';
import { VenueDeatilModule } from './modules/venueDeatil/venueDeatil.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingModule } from './modules/booking/booking.module';
import { BecomeAHostPartnerModule } from './modules/become_a_host_partner/become_a_host_partner.module';
import { PropertyModule } from './modules/property/property.module';

import { CommonModule } from './common/common.module';
import { LogsModule } from './logs/logs.module';
import { NotificationModule } from './notifications/notification.module';
import { StorageModule } from "./common/storage/storage.module";

import { AuthAdminModule } from './modules/admin/admin_auth/admin_auth.module';
import { VendorModule } from './modules/admin/vendor/vendor.module';
import { ActivityLogsModule } from './modules/admin/activity-logs/activity-logs.module';
import { CurrencyModule } from './modules/admin/currency/currency.module';
import { CountryModule } from './modules/admin/country/country.module';
import { EventTagsModule } from "./modules/admin/event-tag/event-tag.module";
import { VenueTagsModule } from "./modules/admin/venue-tags/venue-tag.module"
import { PropertyTagModule } from "./modules/admin/property-tag/property-tag.module"
import { MasterModule } from "./modules/admin/master/master.module"


import { LoyaltyModule } from "./modules/admin/loyalty/loyalty.module"

// import { VenueTagsModule } from "./modules/admin/property-tag/property-tag.module";
// import { CategoryPropertyModule } from './modules/admin/property_category/category.module';
import { VenueCategoryModule } from './modules/admin/venue-category/venue-category.module';
import { UnregisteredModule } from './modules/admin/scraped-data/scraped-data.module';
import { ListedVendorModule } from './modules/admin/listed_vendor/listed_vendor.module';
import { CustomerModule } from './modules/admin/customer/customer.module';
import { GlobalModule } from './modules/global/global.module';
import { ListingModule } from './modules/listing/listing.module';



import { GatewaysModule } from './gateways/gateways.module';
import { SocketModule } from './modules/socket/socket.module';
import { PushModule } from './modules/push/push.module';

//vendor
import { VenueListingModule } from './modules/vendor/venue-listing/venue-listing.module';
import { ParentListingModule } from './modules/vendor/parent-listing/parent-listing.module';
import { KycModule } from './modules/vendor/kyc/kyc.module';
import { PackagesModule } from './modules/vendor/packages/packages.module';
import { SettingsModule } from './modules/vendor/settings/settings.module';
import { BookingsModule } from './modules/vendor/bookings/bookings.module';
import { ChatModule } from './modules/vendor/chat/chat.module';

import { AgingModule } from './modules/vendor/reports/aging/aging.module';

import { InvoiceModule } from './modules/invoice/invoice.module';

//Third party API

import { SurepassModule } from "./modules/integrations/surepass/surepass.module"
import { CashfreeModule } from "./modules/integrations/cashfree/cashfree.module"
import { StripeModule } from "./modules/integrations/stripe/Stripe.module"

import { CompareModule } from "./modules/compare/compare.module"
import { PaxModule } from "./modules/pax/pax.module"
import { RazorpayModule } from "./modules/integrations/rozarPay/razorpay.module"
import { CheckoutModule } from "./modules/checkout/checkout.module"


@Module({
  imports: [

    /* CONFIG */
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    /* DATABASE */
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: '13.50.209.14',
      port: 3306,
      username: 'vb_user',
      password: 'Syfte_2020',
      database: 'vb_platform',
      autoLoadEntities: true,
      synchronize: false,
      logging: true,
      connectTimeout: 10000,
    }),

    GatewaysModule,
    SocketModule,

    /* USER MODULES */
    HomeModule,
    CategoryModule,
    VenueModule,
    VenueDeatilModule,
    AuthModule,
    BookingModule,
    BecomeAHostPartnerModule,
    PropertyModule,

    CommonModule,
    LogsModule,
    NotificationModule,
    StorageModule,

    /* ADMIN MODULES */
    AuthAdminModule,
    ActivityLogsModule,
    VendorModule,
    CurrencyModule,
    CountryModule,
    EventTagsModule,
    VenueTagsModule,
    VenueCategoryModule,
    UnregisteredModule,
    ListedVendorModule,
    GlobalModule,
    ListingModule,
    PropertyTagModule,
    CustomerModule,
    
    VenueListingModule,
    ParentListingModule,
    MasterModule,
    KycModule,
    PackagesModule,
    SettingsModule,
    BookingsModule,
    ChatModule,
    // CategoryPropertyModule
    // VenueTagsModule,

    InvoiceModule,

    SurepassModule,
    CashfreeModule,
    StripeModule,

    PushModule,
    AgingModule,

    LoyaltyModule,

    //
    CompareModule,
    PaxModule,
    RazorpayModule,

    CheckoutModule



    
  ],

  /* ✅ FIX IS HERE */
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLogInterceptor,
    },
  ],

})
export class AppModule {}