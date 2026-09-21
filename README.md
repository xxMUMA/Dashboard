# Snowlax Dashboard

An open-source social listening dashboard being built in public over seven days.

The goal is to create one simple place where people can search for a person, brand, product, or topic and understand the public conversation around it.

> I am a beginner and I am sharing the progress, problems, and lessons from every day of the build. If you are learning too, you are welcome to follow the project, use the dashboard, and build along with me. Suggestions and contributions are welcome.

## What the dashboard will do

- Search for public mentions of a name, brand, product, or topic
- Let users choose a supported social platform
- Filter results by date
- Display the author, post, publication time, and engagement
- Save searches and mentions for later review
- Classify sentiment as positive, neutral, or negative
- Show how mentions, engagement, and sentiment change over time
- Provide a responsive light and dark interface

## Seven-day challenge

| Day | Focus | Status |
| --- | --- | --- |
| 0 | Announce the project and define the scope | Complete |
| 1 | Plan the dashboard and build the foundation | Planned |
| 2 | Connect live public search | Planned |
| 3 | Save searches and mentions | Planned |
| 4 | Add sentiment analysis | Planned |
| 5 | Build trend detection | Planned |
| 6 | Complete the dashboard walkthrough | Planned |
| 7 | Review, improve, document, and release | Planned |

Read the notes for each day in the [seven-day build log](./progress/README.md).

## Technology

- [Next.js](https://nextjs.org/) and TypeScript
- Server-side platform API routes
- [Supabase](https://supabase.com/) Postgres for saved searches and mentions
- AI-powered sentiment analysis
- [Vercel](https://vercel.com/) for deployment

The prototype begins with public data sources that are practical for development. Additional platform integrations depend on their API access, pricing, and policies.

## Run the project locally

### 1. Clone the repository

```bash
git clone https://github.com/xxMUMA/Dashboard.git
cd Dashboard
```

### 2. Install the dependencies

```bash
npm install
```

### 3. Create the local environment file

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Only add credentials for the features you are testing. Never commit `.env.local` or share live API keys.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```text
src/app/          Dashboard pages and server API routes
src/lib/          Shared server and data utilities
supabase/         Database migrations
progress/         Daily challenge notes from Day 0 to Day 7
.env.example      Safe environment-variable template
```

## Project status

This is an educational seven-day prototype under active development. It is not yet production-ready, and platform availability may change according to third-party API rules.

## Contributing

If you know a clearer, safer, or more beginner-friendly way to build a feature, open an issue or pull request and explain your approach. Constructive feedback is part of this challenge.

## Security

- Keep all private credentials in `.env.local`
- Never expose secret keys through variables beginning with `NEXT_PUBLIC_`
- Never commit personal access tokens or production data
- Revoke and replace any credential that is accidentally shared

## Follow the build

The source code and daily updates are available here:

**https://github.com/xxMUMA/Dashboard**
