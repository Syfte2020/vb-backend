import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CompareService {
  constructor(private dataSource: DataSource) {}

  async Availability(body :any) {

   const venueIds = body.venueId
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const placeholders = venueIds.map(() => "?").join(",");

const query = `
SELECT
    v.venue_id,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM booking_venues bv
            INNER JOIN booking_event_dates bed
                ON bed.booking_id = bv.booking_id
            INNER JOIN booking_shifts bs
                ON bs.booking_id = bv.booking_id
               AND bs.event_date_id = bed.id
            WHERE bv.child_venue_id = v.venue_id
              AND bed.event_date = ?
              AND LOWER(bs.shift_name) = LOWER(?)
              AND bs.status NOT IN ('cancelled', 'rejected')
        )
        THEN 'Booked'
        ELSE 'Available'
    END AS availability
FROM (
    ${venueIds.map(() => "SELECT ? AS venue_id").join(" UNION ALL ")}
) v;
`;

const result = await this.dataSource.query(query, [
  body.date,
  body.shift,
  ...venueIds,
]);

return result;
  }
}