# StudyFlow AI - Product Requirements Document

## Overview
StudyFlow AI is a premium React Native + Expo mobile productivity app for students. It combines task planning, focus tools, exam prep, and an AI tutor in one Notion/Linear-inspired interface with full dark/light mode.

## Tech Stack
- **Frontend**: React Native + Expo Router (TypeScript), expo-google-fonts (Outfit/Manrope), lucide-react-native icons, react-native-svg charts, AsyncStorage for token persistence.
- **Backend**: FastAPI + Motor (async MongoDB) on port 8001 with `/api` prefix.
- **AI**: GPT-5.2 via emergentintegrations + Emergent Universal LLM Key.
- **Auth**: Emergent-managed Google OAuth (1-tap) + Guest mode (no auth required).

## Pages
1. Splash (`/`) — animated logo, redirects based on auth state
2. Login (`/login`) — Google + Guest, hero image with gradient
3. Tabs:
   - Home (`/(tabs)`) — greeting, weekly stats, focus card (pomodoro CTA), up-next, quick actions
   - Planner (`/(tabs)/planner`) — tasks/assignments/exams with filters, AI Plan generator
   - Calendar (`/(tabs)/calendar`) — month grid + agenda for selected day
   - AI Tutor (`/(tabs)/chatbot`) — multi-turn GPT-5.2 chat with prompt suggestions
   - Profile (`/(tabs)/profile`) — theme toggle, notifications, sign out
4. Stack: Pomodoro (`/pomodoro`), Analytics (`/analytics`), Notes (`/notes`)

## Key Features
- **AI study schedule generation** — `/api/ai/schedule` returns JSON plan, applied as tasks
- **AI tutor chat** — multi-turn with persistent history per user
- **Pomodoro timer** — circular SVG progress, presets (15/25/45/60 min), logs sessions
- **Analytics** — weekly bar chart, streak, completion rate, total sessions
- **SAT/IELTS prep tracker** — incremental progress (0–100%) per exam
- **Notes** — CRUD with subject tagging
- **Tasks** — CRUD with type (task/assignment/exam), priority, subject, due date
- **Calendar** — month view highlights days with due tasks
- **Theme** — light/dark/system, persisted in AsyncStorage

## Backend Endpoints
- `POST /api/auth/session`, `POST /api/auth/guest`, `GET /api/auth/me`, `POST /api/auth/logout`
- `GET/POST/PATCH/DELETE /api/tasks`
- `GET/POST/PATCH/DELETE /api/notes`
- `GET/POST /api/pomodoro`
- `GET/PATCH /api/prep`
- `GET /api/analytics/summary`
- `GET /api/chat/history`, `POST /api/chat`, `DELETE /api/chat/history`
- `POST /api/ai/schedule`

## MongoDB Collections
`users`, `user_sessions`, `tasks`, `notes`, `pomodoro_sessions`, `prep_progress`, `chat_messages`

## Auth Flow
- Google: `auth.emergentagent.com` → redirect with `session_id` → `/api/auth/session` exchanges for `session_token` → stored via AsyncStorage + httpOnly cookie.
- Guest: `/api/auth/guest` creates anonymous user + session.
- Tokens sent as `Authorization: Bearer <token>`.

## Smart Business Enhancement
- **AI Plan generator** turns one-line goals into a structured 7-day study plan auto-added to the planner — driving daily app re-engagement and word-of-mouth among study peers (high virality lever for student utility apps).
