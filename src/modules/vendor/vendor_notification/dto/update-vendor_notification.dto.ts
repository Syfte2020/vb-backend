import { PartialType } from '@nestjs/mapped-types';
import { CreateVendorNotificationDto } from './create-vendor_notification.dto';

export class UpdateVendorNotificationDto extends PartialType(CreateVendorNotificationDto) {}
