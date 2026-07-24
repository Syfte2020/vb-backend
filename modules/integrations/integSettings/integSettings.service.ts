import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class IntegrationService {
  constructor(
    private readonly dataSource: DataSource,
  ) {}

  async getIntegrationConfig(code: string) {
   
    const rows = await this.dataSource.query(
      `
      SELECT
          i.id,
          i.name,
          i.code,
          s.config_key,
          s.config_value
      FROM integrations i
      LEFT JOIN integration_configs s
          ON s.integration_id = i.id
      WHERE i.code = ?
      AND i.status = 1
      AND s.is_active = 1
      `,
      [code],
    );

    if (!rows.length) {
      throw new NotFoundException('Integration not found');
    }

    const config = {};

    rows.forEach((row) => {
      config[row.config_key] = row.config_value;
    });

    return config;
  }
}