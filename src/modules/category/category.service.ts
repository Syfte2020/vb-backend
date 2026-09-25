import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CategoryService {
  constructor(private dataSource: DataSource) {}

  async getCategories() {
    return this.dataSource.query(`
      SELECT id, name
      FROM venue_categories
      ORDER BY name ASC
    `);
  }
}