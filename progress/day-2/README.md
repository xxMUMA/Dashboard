# Day 2 — Live Search

## What I built

- Connected the dashboard to public Bluesky posts through a server route.
- Added search by topic and date range, with up to 25 recent results.
- Displayed each post's author, date, text, engagement, and original link.
- Added total mentions and engagement, plus loading, empty, and error states.

The date filter applies to the recent posts returned by Bluesky; it does not search the entire historical archive. Search results are not saved yet—that is the Day 3 task.

## Demo

[Watch the Day 2 landscape video](./Snowlax_Day2_Live_Search.mp4).

## What I learned

Connecting a real source also means handling cases where the source returns no posts or temporarily fails. A clear result state is as important as the happy path.

## Problem I faced

Broad terms can return unrelated posts, and public search results are limited. I will keep improving search quality as the project grows.

## Next

Save searches and mentions so results remain available after refreshing the dashboard.
