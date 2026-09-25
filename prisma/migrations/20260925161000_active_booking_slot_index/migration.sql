-- Create partial unique index to enforce that only one active (PENDING or CONFIRMED) booking exists per slot
CREATE UNIQUE INDEX "unique_active_booking_slot" ON "bookings"("centreId", "testId", "appointmentAt") WHERE "status" IN ('PENDING', 'CONFIRMED');
