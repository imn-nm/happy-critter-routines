# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start development server with Vite
- `npm run build` - Production build
- `npm run build:dev` - Development build
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Installation
- `npm i` - Install dependencies

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom gradient themes
- **State Management**: React Query (TanStack) for server state
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Routing**: React Router DOM
- **Forms**: React Hook Form with Zod validation
- **Drag & Drop**: @dnd-kit for task reordering

### Application Structure

**Family Task Management System**: A gamified task management app for children with parent oversight. Children earn coins by completing tasks and can spend them on rewards, with virtual pets providing engagement.

**Key Data Models:**
- **Children**: Profiles with schedules (wake, meals, school, bedtime), coins, and pet happiness
- **Tasks**: Three types - scheduled (fixed time), regular (recurring), flexible (anytime)
- **Task Completions**: Track when tasks are done, coins earned, duration spent
- **Task Sessions**: Active task timing with start/end tracking
- **Rewards**: Items children can purchase with earned coins
- **Reward Purchases**: Transaction history for reward redemptions

**Database Schema** (Supabase):
- `profiles` - Parent user accounts
- `children` - Child profiles with scheduling and pet data
- `tasks` - Task definitions with timing, coin values, recurrence
- `task_completions` - Completion records
- `task_sessions` - Active task timing
- `rewards` - Available rewards per child
- `reward_purchases` - Purchase transactions

### Key Routes
- `/` - Landing/Index page
- `/dashboard` - Parent dashboard showing all children
- `/setup` - Child profile creation
- `/child/:childId` - Child-facing interface for task completion
- `/child-dashboard/:childId` - Parent view of specific child
- `/tasks` - Task management for parents
- `/reports/:childId` - Progress reports for child

### Component Organization

**Pages**: Main route components in `src/pages/`
**Components**: Reusable components in `src/components/`
- Task-related: `TaskForm`, `TaskCard`, `TaskList`, `DragDropTaskList`
- Child-related: `ChildCard`, `ChildProfileEdit`
- Scheduling: `WeekView`, `MonthView`, `TimelineView`, `TodaysScheduleTimeline`
- Gamification: `PetAvatar`, `RewardsManagement`, `CircularTimer`
- UI: Complete shadcn/ui component library in `src/components/ui/`

**Hooks**: Custom hooks in `src/hooks/`
- `useAuth` - Authentication with development auto-login
- `useChildren` - Child profile management
- `useTasks` - Task CRUD operations
- `useTaskSessions` - Active task timing
- `useCompletions` - Task completion tracking
- `useRewards` - Reward system management

### Authentication
Development mode with auto-login functionality using test credentials (test@taskie.app). The app automatically creates accounts and handles authentication for development purposes.

### State Management Patterns
- React Query for all server state (Supabase operations)
- Local state with useState/useEffect for UI concerns
- Custom hooks encapsulate data fetching and mutations
- Real-time updates via Supabase subscriptions where needed

### UI/UX Patterns
- Gradient-based design system with custom Tailwind classes
- Responsive design with mobile-first approach
- Card-based layouts throughout
- Drag-and-drop interfaces for task management
- Timer components for task sessions
- Toast notifications for user feedback

### Development Notes
- All components use TypeScript with proper interface definitions
- Database types are auto-generated from Supabase schema
- Form validation with Zod schemas and React Hook Form
- Comprehensive error handling with toast notifications
- Component composition patterns with shadcn/ui