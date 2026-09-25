import { IsDateString } from 'class-validator';

/**
 * Query for GET /vendor/venues/:venueId/calendar/blocks?from=YYYY-MM-DD&to=YYYY-MM-DD
 * `from`/`to` are inclusive — pass whatever date range the calendar view
 * currently has rendered (a month, a scroll window, etc.) so the response
 * stays small instead of returning every block ever set for the venue.
 */
export class ListShiftBlocksQueryDto {
  @IsDateString()
  from?: string;

  @IsDateString()
  to?: string;
}