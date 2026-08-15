# Current Architecture

This file contains the current architecture snapshot and migration notes. Diagrams have been added under `architecture/diagrams/` as draw.io placeholders. Edit the draw.io files with diagrams.net to represent:

- System architecture
- Component diagram
- Sequence diagrams
- Use case, class, activity, state, deployment, ERD, DFD, flowcharts, C4, network, package, object diagrams

Migration note: The team is migrating off Base44 to a Next.js + Supabase app deployed on Vercel. See `../docs/MIGRATION_PLAN.md` for the full technical plan.
# Current Architecture

## Overview

The current solution is a React single-page application (SPA) built with Vite that relies on the Base44 platform for backend functionality.

## Frontend

- `src/main.jsx` boots the React app.
- `src/App.jsx` sets up routing, authentication, and page layout.
- Authentication is managed by `src/lib/AuthContext.jsx`.
- Data fetching is implemented using the Base44 SDK and React Query.
- The frontend accesses business data directly through the Base44 client and entity APIs.

## Backend

There is no custom backend in this repository. Backend features are provided by Base44:

- `base44.entities.*` for CRUD operations and filtered queries.
- `base44.functions.invoke(...)` for serverless business logic.
- Base44 manages auth and app settings.

## Domain Integration

The current architecture includes these domain models in `base44/entities/*.jsonc`:

- `Staff`
- `Facility`
- `Post`
- `ShiftTemplate`
- `ShiftAssignment`
- `ShiftRequest`
- `EmployeeRequest`
- `StaffingRequirement`
- `SystemConfig`
- `User`

The frontend uses these entities directly for scheduling, staffing, requests, and configuration.

## Service Flow

1. User loads the app.
2. `AuthContext` reads app parameters and checks auth via Base44.
3. React Query requests data from Base44 entities.
4. User actions create/update Base44 entities or invoke Base44 functions.
5. Notifications and scheduled tasks are handled by Base44 functions.

## Current Limitations

- Strong coupling between frontend and Base44.
- No local backend code to control business logic.
- Difficult to host independently or extend outside Base44.
- Domain logic and data access are spread through frontend components.

## Diagram Summary

The current architecture is:

- React SPA -> Base44 SDK -> Base44 entity APIs / functions
- Auth and config hosted by Base44
- Scheduling and request workflows managed by the frontend
