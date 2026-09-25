import { Injectable } from '@nestjs/common';
import { DataSource, Repository, Not, IsNull } from 'typeorm';

@Injectable()
export class VendorNotificationService {

  constructor(
      private dataSource: DataSource
    ) {}
 
  findAll(user_id:any) {
    
    
  }

}
