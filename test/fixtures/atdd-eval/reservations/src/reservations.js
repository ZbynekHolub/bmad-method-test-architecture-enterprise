'use strict';

/** Stable provider state for independent acceptance scenarios. Reservation routes are not wired yet. */
const reservationsByLocker = new Map([
  [
    'L-217',
    {
      reservationId: 'R-SEED-217',
      lockerId: 'L-217',
      parcelId: 'PARCEL-SEED-217',
      expiresAt: '2099-01-01T00:00:00.000Z',
    },
  ],
  [
    'L-330',
    {
      reservationId: 'R-SEED-330',
      lockerId: 'L-330',
      parcelId: 'PARCEL-SEED-330',
      expiresAt: '2099-01-01T00:00:00.000Z',
    },
  ],
]);

module.exports = { reservationsByLocker };
