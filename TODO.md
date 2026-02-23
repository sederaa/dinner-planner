# Dinner Planner - Development Progress

**Timeline:** 4-6 days of focused development for MVP  
**Started:** 12 February 2026

---

## Phase 1: Foundation (Day 1)

- [x] Set up React + TypeScript + Vite + TailwindCSS
- [x] Install and configure shadcn/ui
- [x] Define TypeScript types/interfaces
- [x] Connect to Supabase client (configured, needs .env)
- [x] Set up Supabase project and create all tables
- [x] Basic routing and layout structure

## Phase 2: Dish Management (Day 2)

- [x] Dish CRUD operations (UI + API)
- [x] Dish list view with filters (type, proteins, time, spicy)
- [x] Add/edit dish form with all fields
- [x] Status toggle (enabled/manual_only/disabled)
- [x] Special dishes (Leftovers, Eating Out) UI elements

## Phase 3: Calendar & Manual Planning (Days 3-4)

- [x] Weekly calendar view (14 days, starting Monday)
- [x] Manual meal assignment (drag-and-drop or click to add)
- [x] Support for main + multiple sides + dessert per day
- [x] Lock/unlock days
- [x] Mark guests and office days (pre-populated from settings with override)
- [x] Export to clipboard functionality

## Phase 4: Rules & Auto-Suggest (Days 5-6)

- [x] Rules configuration UI with customizable points
- [x] Implement all 6 core rules:
  - [x] no_fish_before_office_days
  - [x] no_consecutive_same_protein
  - [x] no_spicy_with_guests
  - [x] prefer_easy_on_dual_office_days
  - [x] prioritize_ingredient
  - [x] dish_cooldown_period
- [x] Pre-populate rules with default point values
- [x] Build scoring/ranking algorithm
- [x] Auto-suggest functionality (all days / selected days)
- [x] Rule violation indicators
- [ ] Swap/alternative suggestions
- [ ] Unit tests for rules engine and auto-suggestion logic

## Phase 5: Polish & History (Day 7)

- [ ] Historical view for past meal plans
- [ ] Responsive design for mobile browsers (touch-friendly, mobile-sized screens)
- [ ] Loading states & error handling
- [ ] User settings management
- [ ] Session-based filter persistence

## Phase 6: Docker & Deploy (Day 8)

- [ ] Create Dockerfile (multi-stage build)
- [ ] Environment configuration
- [ ] Build and test container
- [ ] NAS deployment instructions

---

## Current Status

**Phase:** 4 - Rules & Auto-Suggest  
**Last Updated:** 18 February 2026  
**Next Task:** Swap/alternative suggestions

---

## Notes

- App is intentionally simple: no authentication, straightforward CRUD operations
- Single-user app (developer authenticates to Supabase)
- Focus on rules engine and auto-suggestion as core differentiators
