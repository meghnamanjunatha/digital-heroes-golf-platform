# Digital Heroes Golf Platform

## Overview

A full-stack MVP based on the Digital Heroes PRD. The core flow is signup/login → subscription → charity selection → score management → draw → winner verification → payout.

## Tech Stack

React + Vite · FastAPI · Supabase PostgreSQL + Auth · Render · Vercel

## Implemented Features

- Signup and login; user and admin dashboards
- Monthly/yearly subscription selection
- Charity selection with a minimum 10% contribution
- Golf score CRUD, duplicate-date validation, and rolling latest-five-score logic
- Random draw generation, 3/4/5-match winner detection, and prize calculation
- User winnings view and winner proof submission
- Admin winner approval/rejection and marking payouts as paid

## Live URLs

- Frontend: https://digital-heroes-golf-platform-nine.vercel.app
- Backend: https://digital-heroes-golf-platform.onrender.com
- API docs: https://digital-heroes-golf-platform.onrender.com/docs

## Local Setup

Set the environment variables listed below before starting the services.

Backend:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Frontend, in a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Backend: `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`

Frontend: `VITE_API_BASE_URL`

## Known MVP Limitations

- Admin actions require authentication but are not yet role-restricted.
- Payment is simulated; Stripe is not integrated.
- The prize pool is fixed at 1000.
- Draw numbers are random; an algorithmic weighted draw is not implemented.
