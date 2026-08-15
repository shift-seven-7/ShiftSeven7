# Domain Model

## Purpose

This document describes the key entities and relationships for the new architecture. It is intended to guide database design and service boundaries.

## Core Entities

### `Staff`

Represents a security employee.

- `id`
- `full_name`
- `employee_id`
- `role`
- `qualification`
- `primary_facility_id`
- `phone`
- `email`
- `status`
- `access_level`
- `weapon_license_expiry`
- `weapon_refresh_expiry`
- `medical_check_expiry`

### `Facility`

Represents a physical site.

- `id`
- `name`
- `code`
- `address`
- `status`

### `Post`

Represents a working station or post within a facility.

- `id`
- `name`
- `facility_id`
- `description`

### `ShiftTemplate`

Defines a repeatable shift.

- `id`
- `code`
- `name`
- `category`
- `start_time`
- `end_time`
- `duration_hours`
- `post_number`
- `color`
- `applicable_roles`
- `facility_id`

### `ShiftAssignment`

Represents a staff member assigned to a shift on a specific date.

- `id`
- `staff_id`
- `shift_template_id`
- `post_id`
- `facility_id`
- `date`
- `actual_start`
- `actual_end`
- `status`
- `is_published`
- `is_emergency_override`
- `override_reason`
- `approved_by`

### `ShiftRequest`

Represents a requested shift by a staff member.

- `id`
- `staff_id`
- `facility_id`
- `week_start`
- `date`
- `shift_template_id`
- `status`

### `EmployeeRequest`

Represents a non-scheduling HR-type request.

- `id`
- `staff_id`
- `type`
- `status`
- `start_date`
- `end_date`
- `file_url`
- `file_name`
- `notes`
- `manager_comment`
- `handled_by`

### `StaffingRequirement`

Represents staffing needs for a facility and date.

- `id`
- `facility_id`
- `date`
- `required_count`
- `role`
- `status`

### `SystemConfig`

Represents runtime configuration values.

- `id`
- `key`
- `value`
- `description`
- `category`

### `User`

Represents an authenticated system user.

- `id`
- `email`
- `name`
- `role`
- `status`

## Relationships

- `ShiftAssignment.staff_id` → `Staff.id`
- `ShiftAssignment.shift_template_id` → `ShiftTemplate.id`
- `ShiftAssignment.post_id` → `Post.id`
- `ShiftAssignment.facility_id` → `Facility.id`
- `Staff.primary_facility_id` → `Facility.id`
- `ShiftTemplate.facility_id` → `Facility.id`
- `ShiftRequest.staff_id` → `Staff.id`
- `ShiftRequest.facility_id` → `Facility.id`
- `EmployeeRequest.staff_id` → `Staff.id`
- `Post.facility_id` → `Facility.id`

## Recommended Schema Notes

- Keep IDs as UUIDs for portability.
- Use foreign keys for referential integrity.
- Avoid denormalized source-of-truth values unless needed for read performance.
- Store denormalized labels only as cache values on assignments when necessary.
- Use separate service schemas if needed for strong boundaries.
