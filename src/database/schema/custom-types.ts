import { customType } from 'drizzle-orm/pg-core';

export const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geography(Point, 4326)';
  },
});
