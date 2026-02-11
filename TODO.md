# Dinner Planner - Development Progress

**Timeline:** 4-6 days of focused development for MVP  
**Started:** 12 February 2026

---

## Phase 1: Foundation (Day 1)

- [x] Set up React + TypeScript + Vite + TailwindCSS
- [ ] Install and configure shadcn/ui
- [ ] Set up Supabase project and create all tables
- [ ] Define TypeScript types/interfaces
- [ ] Basic routing and layout structure
- [ ] Connect to Supabase client

## Phase 2: Dish Management (Day 2)

- [ ] Dish CRUD operations (UI + API)
- [ ] Dish list view with filters (type, proteins, time, spicy)
- [ ] Add/edit dish form with all fields
- [ ] Status toggle (enabled/manual_only/disabled)
- [ ] Special dishes (Leftovers, Eating Out) UI elements

## Phase 3: Calendar & Manual Planning (Days 3-4)

- [ ] Weekly calendar view (14 days, starting Monday)
- [ ] Manual meal assignment (drag-and-drop or click to add)
- [ ] Support for main + multiple sides + dessert per day
- [ ] Lock/unlock days
- [ ] Mark guests and office days (pre-populated from settings with override)
- [ ] Block day functionality
- [ ] Export to clipboard functionality

## Phase 4: Rules & Auto-Suggest (Days 5-6)

- [ ] Rules configuration UI with customizable points
- [ ] Implement all 6 core rules:
  - [ ] no_fish_before_office_days
  - [ ] no_consecutive_same_protein
  - [ ] no_spicy_with_guests
  - [ ] prefer_easy_on_dual_office_days
  - [ ] prioritize_ingredient
  - [ ] dish_cooldown_period
- [ ] Pre-populate rules with default point values
- [ ] Build scoring/ranking algorithm
- [ ] Auto-suggest functionality (all days / selected days)
- [ ] Rule violation indicators
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

**Phase:** 1 - Foundation  
**Last Updated:** 12 February 2026  
**Next Task:** Install shadcn/ui and set up Supabase

---

## Notes

- App is intentionally simple: no authentication, straightforward CRUD operations
- Single-user app (developer authenticates to Supabase)
- Focus on rules engine and auto-suggestion as core differentiators
