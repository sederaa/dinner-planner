# Dinner Planning App - Specification

## Overview

A web-based application to help a family plan dinners for 1-2 weeks ahead based on customizable rules and constraints. The app optimizes meal selection considering work schedules, dietary preferences, guest visits, and shopping specials.

## Core Purpose

- Plan weekly/bi-weekly dinner menus
- Apply smart rules to avoid incompatible combinations (e.g., fish before office days)
- Account for leftovers taken to work the next day
- Manage a personal dish database with key attributes

## Data Models

### Dish

```typescript
{
  id: string;
  name: string;
  type: ("main" | "side" | "dessert")[]; // A dish can be multiple types
  proteins?: string[]; // ["fish", "chicken"], ["beef"], undefined for vegetarian/vegan dishes
  isSpicy: boolean; // Whether the dish is spicy
  time: "low" | "medium" | "high"; // Combined prep time and difficulty
  keyIngredients: string[]; // Array of main ingredients
  status: "enabled" | "manual_only" | "disabled"; // enabled: can be auto-suggested, manual_only: only manual selection, disabled: hidden
  notes?: string;
  tags?: string[]; // Optional tags for categorization
}
```

### Meal Plan

```typescript
{
  id: string;
  date: Date;
  mainDishId: string | "LEFTOVERS" | "EATING_OUT" | null; // Special values for leftover dinners or eating out
  sideDishIds: string[]; // Array of side dish IDs (no maximum)
  dessertDishId?: string; // Optional dessert
  hasGuests: boolean;
  personAGoesToOffice: boolean; // Next day
  personBGoesToOffice: boolean; // Next day
  locked: boolean; // If true, auto-suggest won't replace this day
  notes?: string;
}
```

### Rules

```typescript
type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  points?: number; // Points impact: negative = deducted when violated, positive = awarded when satisfied
} & (
  | { type: "no_fish_before_office_days" }
  | { type: "no_consecutive_same_protein"; maxConsecutiveDays: number }
  | { type: "no_spicy_with_guests" } // Binary: no spicy dishes when guests present
  | { type: "prefer_easy_on_dual_office_days" }
  | { type: "prioritize_ingredient"; ingredient: string } // e.g., "beef", "zucchini"
  | { type: "dish_cooldown_period"; cooldownDays: number }
);

// Example instances:
// { type: "no_spicy_with_guests", points: -30 } // Deduct 30 points when violated
// { type: "prioritize_ingredient", ingredient: "beef", points: 20 } // Award 20 points when satisfied
```

### User Settings

```typescript
{
  planningHorizonDays: number; // 7, 14, etc. (default: 14)
  defaultOfficeDays: {
    personA: string[]; // ["monday", "tuesday", "wednesday", "thursday"]
    personB: string[]; // ["monday", "tuesday", "wednesday", "thursday"]
  }
}
// Note: Week always starts on Monday. Family has 2 adults + kids (kids not tracked separately).
```

## Key Features

### 1. Dish Management

- Add/edit/delete dishes (mains, sides, desserts)
- View all dishes in a searchable/filterable list
- Quick filters by type (main/side/dessert), proteins, time, spicy (yes/no)
- Dishes can have multiple proteins (e.g., surf & turf), or none (vegetarian/vegan)
- Set dish status: enabled (auto-suggest), manual_only (only manual selection), or disabled (hidden)
- **Special dishes**: "Leftovers" and "Eating Out" can be dragged onto days
  - Never auto-suggested (manual-only)
  - Not considered in office day rules or protein variety rules
- Manually entered only (no imports at this stage)

### 2. Weekly/Bi-weekly Planner View

- Calendar-style interface showing 7-14 days (always starting Monday)
- Drag-and-drop dishes onto days to build complete meals (main + sides + dessert)
- "Auto-suggest" button with options:
  - Suggest for all unlocked days
  - Suggest for selected days only
- Lock/unlock individual days to prevent auto-suggest from overwriting that day (manual add/edit/clear is still allowed)
- Mark guests and next-day office attendance from each day's `⋯` context menu
- Show day icons only when enabled (e.g., 👥, 🏢A, 🏢B)
- Visual indicators for rule violations
- Export meal plan to clipboard in simple text format
- **Special dishes**: "Leftovers" and "Eating Out" can be dragged onto days

### 3. Rules Engine

- Toggle rules on/off
- Adjust rule parameters (e.g., max consecutive days for same protein, cooldown days)
- Customize points (negative/positive) for each rule (not hard-coded)
- **Default setup**: App comes pre-populated with 6 core rules and suggested default point values

**Core Rules to Implement:**

1. **No fish before office days** (`no_fish_before_office_days`): If leftovers will be taken to office, exclude fish dishes
2. **Protein variety** (`no_consecutive_same_protein`): Avoid same protein 2+ days in a row (configurable max consecutive days)
3. **Guest-friendly** (`no_spicy_with_guests`): Exclude spicy dishes when guests are present (isSpicy = true)
4. **Ingredient prioritization** (`prioritize_ingredient`): Prioritize dishes with specific ingredients (e.g., "beef on special" or "need to finish zucchini")
5. **Easy meals on busy days** (`prefer_easy_on_dual_office_days`): When both go to office next day, prefer low-time meals
6. **Cooldown period** (`dish_cooldown_period`): Don't repeat the same dish within X days (configurable)

### 4. Smart Suggestions

- Generate meal plan based on active rules
- Option to suggest for all days or selected days only
- Respect locked days (never overwrite)
- Special dishes (Leftovers, Eating Out) are never auto-suggested
- If no suitable dishes found for a day, suggest the "least bad" option with warnings
- Show compliance score for manual plans
- Highlight rule violations with explanations
- "Swap" functionality to suggest alternatives for individual days

### 5. Historical View

- View past meal plans (read-only)
- Navigate through previous weeks
- See what was actually planned/cooked
- Useful for avoiding recent repeats and getting ideas

### 6. Export Functionality

- Copy meal plan to clipboard as formatted text
- Format example:

  ```
  Monday 11 February
  - Baked Chicken
  - Side: Salad

  Tuesday 12 February
  - Leftovers

  Wednesday 13 February
  - Pumpkin Soup
  - Side: Cheese Toastie

  Thursday 14 February
  - Eating Out

  Friday 15 February
  - Tacos
  ```

### 7. Shopping List (Future Enhancement)

- Generate shopping list from planned meals
- Group by ingredient category

### 8. Calendar Integration (Future Enhancement)

- Read personal calendars to automatically determine office days
- Auto-populate office attendance based on calendar events

## Technology Stack

### Frontend

- **Framework**: React 18+ with TypeScript + Vite
- **UI Components**: shadcn/ui (built on Radix UI + TailwindCSS)
- **Drag & Drop**: @dnd-kit/core
- **Testing**: Vitest + React Testing Library for unit tests
  - Priority: Rules engine logic
  - Priority: Auto-suggestion algorithm
  - Priority: Other business logic
- **Backend**: Supabase (PostgreSQL + auto-generated REST API)
- **Deployment**: Docker container on NAS

### Backend

**Selected Backend**: **Supabase** - Free tier, PostgreSQL, real-time updates, auto-generated REST API, and simple to deploy.

### Containerization

- Single Dockerfile with multi-stage build
- Frontend: Nginx to serve static React build
- Connects to Supabase cloud
  - **Authentication**: Developer authenticates to Supabase (using project URL and anon key)
  - No end-user authentication required (single-user app)

## User Interface Design

### Main Views

#### 1. Dashboard/Planner View (Home)

```
┌──────────────────────────────────────────────────┐
│  Dinner Planner    [Dishes] [Rules] [History]    │
├──────────────────────────────────────────────────┤
│  Week of Feb 10-16, 2026      [◄] [►] [Export]  │
│  [Auto-Suggest All] [Auto-Suggest Selected]      │
├──────┬──────┬──────┬──────┬──────┬──────┬───────┤
│ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │ Sun   │
│  10  │  11  │  12  │  13  │  14  │  15  │  16   │
│  ☐🔒 │  ☐🔒 │  ☐🔒 │  ☐🔒 │  ☐🔒 │  ☐🔒 │  ☐🔒  │
├──────┼──────┼──────┼──────┼──────┼──────┼───────┤
│Chckn │      │      │      │      │      │       │
│Stirfy│ [+]  │ [+]  │ [+]  │ [+]  │ [+]  │  [+]  │
│Salad │      │      │      │      │      │       │
│      │      │      │      │      │      │       │
│ 🏢🏢  │ 🏢🏢  │ 🏢🏢  │ 🏢🏢  │      │      │       │
│ 👥   │      │      │      │      │ 👥   │       │
└──────┴──────┴──────┴──────┴──────┴──────┴───────┘

Legend: 🏢 = Office next day, 👥 = Guests, 🔒 = Locked, ☐ = Select
```

#### 2. Dish Library View

```
┌──────────────────────────────────────────────────┐
│  Dishes                         [+ Add Dish]     │
├──────────────────────────────────────────────────┤
│  [Search...] 🔍                                  │
│  Filter: [Type ▾] [Proteins ▾] [Time ▾]         │
├──────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────┐ │
│  │ 🍗 Chicken Stir Fry            [Edit] ✓   │ │
│  │ Main | Chicken | Spicy | Time:Low          │ │
│  └────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────┐ │
│  │ 🥗 Green Salad                 [Edit] ⚙    │ │
│  │ Side | Veg | Not Spicy | Time:Low          │ │
│  └────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────┐ │
│  │ 🐟 Grilled Salmon              [Edit] ✗    │ │
│  │ Main | Fish | Not Spicy | Time:Medium      │ │
│  └────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────┐ │
│  │ 🍽️ Leftovers                   [Special]   │ │
│  │ Special dish for leftover dinners          │ │
│  └────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────┐ │
│  │ 🍴 Eating Out                  [Special]   │ │
│  │ Special dish for eating out                │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘

Legend: ✓ = Enabled (auto-suggest), ⚙ = Manual only, ✗ = Disabled
```

#### 3. Rules Configuration View

```
┌──────────────────────────────────────────────────┐
│  Rules                                           │
├──────────────────────────────────────────────────┤
│  ☑ No fish before office days                   │
│  ☑ Vary proteins (max 1 day repeat)        [▾]  │
│  ☑ No spicy dishes with guests                  │
│  ☑ Easy meals on dual-office days               │
│  ☑ Prioritize ingredient: [Beef ▾]         [▾]  │
│  ☑ Don't repeat dishes within: 5 days      [▾]  │
└──────────────────────────────────────────────────┘

Note: Ingredient prioritization can be any key ingredient,
not just protein (e.g., zucchini, tomatoes, etc.)
```

### Interaction Flow

1. **Building a meal for a day:**
   - Click '+' on a day
   - Modal/drawer opens with dish list (filterable by type)
   - Drag or click to add: Main dish → Side dishes → Dessert
   - Dragging dishes onto a day always adds to existing dishes (never replaces)
   - Use each day's `⋯` context menu to toggle: Guests coming, Person A office next day, Person B office next day
     - Office days are pre-populated from `defaultOfficeDays` settings, and can be overridden per day
   - `Clear meal` is available in the same `⋯` context menu
   - Meal appears on calendar, shows any rule violations
  - Can lock/unlock the day using lock icon
  - Lock applies only to auto-generation; manual changes remain available while locked

2. **Auto-generating meals:**
   - Option A: Click "Auto-Suggest All" - fills all unlocked days
   - Option B: Select specific days via checkboxes, click "Auto-Suggest Selected"
   - App analyzes dishes + rules + calendar info + locked days
   - Fills in days with optimal suggestions
   - Locked days are never overwritten
   - User can swap individual days or remove and re-suggest

3. **Exporting meal plan:**
   - Click "Export" button
   - Meal plan copied to clipboard as formatted text
   - Can paste into notes, messages, etc.

4. **Managing dishes:**
   - Go to Dishes view
   - Add/edit/delete dishes via form
   - Set status: "enabled" (auto-suggest), "manual_only" (manual selection only), or "disabled" (hidden)
   - Drag "Leftovers" or "Eating Out" special dishes onto days
   - Filter by type (main/side/dessert), protein, time, spicy (yes/no)
   - Filters and search terms persist for the session (reset on app reload)

5. **Viewing history:**
   - Go to History view
   - Navigate through past weeks (read-only)
   - See what was planned previously

## Rules Engine Logic

### Constraint Scoring System

Each potential dish for each day gets scored (0-100):

- Start at 100
- Apply rule's `points` value (negative points = deduction, positive points = bonus):
  - **Violation rules** (negative points):
    - Hard constraint broken: e.g., -50 for fish before office
    - Same protein as yesterday: default -20
    - Same dish within cooldown: default -100 (effectively excludes)
    - Spicy with guests: default -30
    - Hard meal on busy day: default -15
  - **Satisfaction rules** (positive points):
    - Priority ingredient: default +20
    - Haven't had this in a while: default +10

**Note**: All point values are customizable per rule, not hard-coded.

**Special dish handling**: Days with "Leftovers" or "Eating Out" are not evaluated for office day rules or protein variety rules.

**Cooldown period with no history**: The cooldown rule is ignored for dishes with no historical data until sufficient history exists.

Select highest-scoring dish that's above threshold (e.g., 50 points). If no dish meets threshold, select the least bad option and show warnings.

### Validation on Manual Selection

When user manually selects a dish, show warnings/errors:

- 🔴 Hard constraint violated (red, blocks if strict mode)
- 🟡 Preference not met (yellow, just FYI)
- ✅ All good (green)

## Data Storage Schema (Supabase/PostgreSQL)

### Tables

```sql
-- Dishes
CREATE TABLE dishes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type TEXT[] NOT NULL, -- Array: ['main'], ['side'], ['main', 'side'], etc.
  proteins TEXT[], -- Array of proteins: ['fish'], ['chicken', 'shrimp'], NULL/empty for vegetarian/vegan
  is_spicy BOOLEAN DEFAULT FALSE,
  time VARCHAR(20) CHECK (time IN ('low', 'medium', 'high')), -- Combined prep time + difficulty
  key_ingredients TEXT[], -- PostgreSQL array
  status VARCHAR(20) CHECK (status IN ('enabled', 'manual_only', 'disabled')) DEFAULT 'enabled',
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Meal Plans
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  main_dish_id UUID REFERENCES dishes(id) ON DELETE SET NULL,
  main_dish_type VARCHAR(20) CHECK (main_dish_type IN ('dish', 'leftovers', 'eating_out')), -- Special types for leftover or eating out
  side_dish_ids UUID[], -- Array of side dish IDs (no maximum)
  dessert_dish_id UUID REFERENCES dishes(id) ON DELETE SET NULL,
  has_guests BOOLEAN DEFAULT FALSE,
  person_a_office_next_day BOOLEAN DEFAULT FALSE,
  person_b_office_next_day BOOLEAN DEFAULT FALSE,
  locked BOOLEAN DEFAULT FALSE, -- Prevents auto-suggest from overwriting
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date)
);

-- Rules Configuration
CREATE TABLE rules_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  rule_type VARCHAR(100) CHECK (rule_type IN (
    'no_fish_before_office_days',
    'no_consecutive_same_protein',
    'no_spicy_with_guests',
    'prefer_easy_on_dual_office_days',
    'prioritize_ingredient',
    'dish_cooldown_period'
  )),
  parameters JSONB NOT NULL, -- Rule-specific parameters (e.g., ingredient, cooldownDays, maxConsecutiveDays)
  points INTEGER, -- Points impact: negative = deducted when violated, positive = awarded when satisfied
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User Settings (single row, weeks always start Monday)
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  planning_horizon_days INTEGER DEFAULT 14,
  default_office_days JSONB, -- {"personA": ["monday", "tuesday", "wednesday", "thursday"], "personB": [...]}
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_meal_plans_date ON meal_plans(date);
CREATE INDEX idx_dishes_proteins ON dishes USING GIN(proteins); -- GIN index for array
CREATE INDEX idx_dishes_status ON dishes(status);
CREATE INDEX idx_dishes_type ON dishes USING GIN(type); -- GIN index for array
```

### Notes on Supabase Schema

Since you're using Supabase cloud, you can create these tables directly in the Supabase SQL Editor. The table schema SQL is provided for reference and documentation, but Supabase will handle the database management. You won't need to maintain separate SQL files or migration scripts unless you want version control for schema changes.

## Development Phases

**Timeline:** 4-6 days of focused development for MVP

### Phase 1: Foundation (Day 1)

- [ ] Set up React + TypeScript + Vite + TailwindCSS + shadcn/ui
- [ ] Set up Supabase project and create all tables
- [ ] Basic routing and layout structure
- [ ] Connect to Supabase

### Phase 2: Dish Management (Day 2)

- [ ] Dish CRUD operations (UI + API)
- [ ] Dish list view with filters (type, protein, time, enabled)
- [ ] Add/edit dish form with all fields
- [ ] Enable/disable toggle

### Phase 3: Calendar & Manual Planning (Days 3-4)

- [ ] Weekly calendar view (14 days, starting Monday)
- [ ] Manual meal assignment (drag-and-drop or click to add)
- [ ] Support for main + multiple sides + dessert per day
- [ ] Lock/unlock days
- [ ] Mark guests and office days
- [ ] Export to clipboard functionality

### Phase 4: Rules & Auto-Suggest (Days 5-6)

- [ ] Rules configuration UI with customizable points
- [ ] Implement all 6 core rules
- [ ] Build scoring/ranking algorithm
- [ ] Auto-suggest functionality (all days / selected days)
- [ ] Rule violation indicators
- [ ] Swap/alternative suggestions
- [ ] Unit tests for rules engine and auto-suggestion logic

### Phase 5: Polish & History (Day 7)

- [ ] Historical view for past meal plans
- [ ] Responsive design for mobile browsers (touch-friendly, mobile-sized screens)
- [ ] Loading states & error handling
- [ ] User settings management

### Phase 6: Docker & Deploy (Day 8)

- [ ] Create Dockerfile
- [ ] Environment configuration
- [ ] Build and test container
- [ ] NAS deployment instructions

**Note on Timeline:** The entire MVP can realistically be built in 4-6 full days of focused work, or 1-2 weeks with part-time effort. The app is intentionally simple - no authentication, no complex business logic, straightforward CRUD operations, and a clear data model.

## Deployment

### Docker Setup

```dockerfile
# Multi-stage build
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Environment Variables

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### NAS Deployment

```bash
docker build -t dinner-planner .
docker run -d -p 8080:80 --name dinner-planner \
  -e VITE_SUPABASE_URL=... \
  -e VITE_SUPABASE_ANON_KEY=... \
  dinner-planner
```

## Clarifications & Assumptions

Based on user feedback:

- **Family composition**: 2 adults (Person A & B) + kids (kids not separately tracked)
- **Portion sizes**: Always assumed sufficient for leftovers - no tracking needed
- **Historical data**: Yes, include read-only view of past meal plans
- **Dietary restrictions**: None at this time
- **Meal types**: Dinner only (lunch/breakfast out of scope)
- **Dish entry**: Manual entry only (no URL import needed)
- **Serving sizes**: Not tracked
- **Other attributes**: Current attributes (protein, spiciness, time, key ingredients) are sufficient
- **Special occasions**: Not needed - manual selection and lock feature is sufficient
- **Notifications**: Not needed at this time

## Out of Scope (For Now)

- Authentication/multi-user support (single-user app, developer authenticates to Supabase)
- Mobile native app (responsive web app with mobile browser support is in scope)
- Nutritional information/calorie tracking
- Detailed ingredient quantities
- Recipe instructions/cooking steps (just key ingredients)
- Shopping integration with supermarkets
- Social sharing features
- Photo uploads for dishes
- Lunch and breakfast planning
- Recipe imports from URLs
- Notifications and reminders
- Advanced side-dish pairing logic (future enhancement)

## Tech Stack Summary

**Selected Stack:**

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui (built on Radix UI + TailwindCSS)
- **Drag & Drop**: @dnd-kit/core
- **Backend**: Supabase (PostgreSQL + auto-generated REST API)
- **Deployment**: Docker container on NAS
- **Development Time**: 4-6 days of focused development

**Why This Stack:**

- **No authentication needed** - Supabase still works great without auth
- **shadcn/ui** - Clean, modern, accessible components (not Material UI)
- **Fast to build** - Supabase handles all backend API, we just focus on UI
- **Easy to deploy** - Single Docker container, environment variables for Supabase connection
