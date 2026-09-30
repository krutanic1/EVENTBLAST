# EventBlast 🚀

> A production-ready MERN dashboard for managing event invitations through Google Calendar.

## Stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Frontend   | React 18 · Vite · Tailwind CSS v4 · React Router |
| Backend    | Node.js · Express · Mongoose            |
| Database   | MongoDB Atlas (free tier)               |
| Auth       | Google OAuth 2.0 *(coming soon)*        |
| Calendar   | Google Calendar API *(coming soon)*     |
| Deploy     | Vercel (frontend + backend)             |

---

## Project Structure

```
eventblast/
├── frontend/          # React + Vite app
│   ├── src/
│   │   ├── components/   # Sidebar, Topbar, Layout, StatCard, EventCard, EventForm
│   │   ├── hooks/        # useEvents custom hook
│   │   ├── lib/          # Axios instance
│   │   ├── pages/        # Dashboard, EventsPage, NewEventPage, EventDetailPage, EditEventPage, SettingsPage
│   │   └── services/     # eventService, healthApi
│   └── ...
└── backend/           # Express API
    ├── src/
    │   ├── config/       # db.js (MongoDB connection)
    │   ├── middleware/   # errorHandler.js
    │   ├── models/       # Event.js (Mongoose schema)
    │   └── routes/       # health.js, events.js
    └── ...
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- A [MongoDB Atlas](https://cloud.mongodb.com) free-tier cluster

---

### 1. Backend

```bash
cd eventblast/backend

# Install dependencies
npm install

# Create your environment file
cp .env.example .env
# Then edit .env and set MONGO_URI to your Atlas connection string

# Start dev server
npm run dev
# → http://localhost:5000
```

**Health check:**
```bash
curl http://localhost:5000/api/health
```

---

### 2. Frontend

```bash
cd eventblast/frontend

# Install dependencies (already done if you ran npm install)
npm install

# Create local env (optional; Vite proxy handles /api in dev)
cp .env.example .env.local

# Start dev server
npm run dev
# → http://localhost:5173
```

---

## API Reference

| Method | Endpoint           | Description              |
|--------|--------------------|--------------------------|
| GET    | `/api/health`      | API + DB liveness check  |
| GET    | `/api/events`      | List events (paginated)  |
| POST   | `/api/events`      | Create event             |
| GET    | `/api/events/:id`  | Get single event         |
| PATCH  | `/api/events/:id`  | Update event             |
| DELETE | `/api/events/:id`  | Delete event             |

### Query parameters for `GET /api/events`

| Param    | Default | Description         |
|----------|---------|---------------------|
| `page`   | `1`     | Page number         |
| `limit`  | `10`    | Results per page    |
| `status` | —       | Filter by status    |

---

## Deployment

Both the frontend and backend are compatible with Vercel serverless deployment.

### Backend → Vercel

```bash
cd eventblast/backend
npx vercel --prod
```

Configure the following Environment Variables in your Vercel Dashboard:
- `MONGO_URI`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ENCRYPTION_KEY`
- `SESSION_SECRET`
- `JWT_SECRET`
- `CRON_SECRET`

**Vercel Cron Triggers:**
EventBlast uses a serverless-native queue processor instead of long-running daemons. 
Vercel Cron Triggers are configured in `vercel.json` to ping the queue processor every minute.

To secure the queue endpoint:
1. Generate a strong random string (e.g. `openssl rand -hex 32`).
2. Add it as the `CRON_SECRET` environment variable in your Vercel project settings.
3. Vercel will automatically inject this secret as a `Bearer` token in the `Authorization` header when it triggers the cron job.

### Frontend → Vercel

```bash
cd eventblast/frontend
npx vercel --prod
# Set VITE_API_URL to your backend Vercel URL
```

---

## Roadmap

- [x] Basic Express API with CRUD
- [x] MongoDB Atlas integration
- [x] React dashboard with dark theme
- [x] Google OAuth 2.0
- [x] Google Calendar event creation
- [x] Background job processor (Serverless compatible)
- [x] Campaign tracking & control dashboard

---

## License

MIT
