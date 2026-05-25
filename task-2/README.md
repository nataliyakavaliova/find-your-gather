# Find Your Gather — Event Hosting Platform

A lightweight platform for hosting and attending free community events.
Built with React, TypeScript, Tailwind, Supabase, and Lovable AI.

**Live demo:** https://find-your-gather.lovable.app

(Replace with your actual deployed URL)

## Demo accounts

You can sign up your own account, or use the seeded demo host account 
(if available — check the Lovable preview).

## Main user flows

### Flow 1: Publish an event (Host)

1. Sign in or sign up at `/signin`
2. Click "Become a Host" in the top menu
3. Fill in your host profile: name, bio, contact email, logo
4. You'll be redirected to `/dashboard`
5. Click "New event"
6. Fill in event details: title, description, date and time, venue 
   address or online link, capacity, cover image
7. Choose visibility: Public (searchable on Explore) or Unlisted 
   (only accessible by direct link)
8. Click "Publish" — your event becomes live

The Free/Paid toggle in the editor has Paid disabled with a 
"Coming soon" tooltip — only free events are currently supported.

### Flow 2: RSVP and receive a ticket (Attendee)

1. Browse events on the Explore page or open a direct link
2. As a signed-in user, click "RSVP" on an upcoming event
   - If the event has free seats: you are confirmed as "Going"
   - If the event is full: you join the waitlist with a position number
3. Your ticket appears on the `/tickets` page with:
   - A unique QR code (image)
   - The code as text below the QR (for manual entry at check-in)
   - "Add to Calendar" button (downloads .ics)
4. If someone with a confirmed seat cancels, the first person on the 
   waitlist is automatically promoted to "Going" — they will see their 
   new status the next time they open the event or tickets page.
5. You can cancel your RSVP at any time from `/tickets`.

### Flow 3: Check-in attendees (Checker or Host)

1. The host invites a Checker via Dashboard → Members → Invite member
2. The invited person opens the link, signs in, and accepts the invitation
3. On the day of the event, the Checker (or Host) opens the event's 
   check-in page at `/events/:id/checkin` 
   (also accessible from My Events → Check-in)
4. They enter ticket codes manually (the short code printed below the 
   QR on each ticket)
5. Each successful check-in updates the live counter at the top of 
   the page
6. The most recent check-in can be undone with one click
7. Duplicate scans are detected and rejected — the same ticket cannot 
   be checked in twice

### Flow 4: Post-event (Attendees + Host)

After an event ends (`ends_at` < current time):

- Attendees with a "Going" RSVP can leave feedback: 1–5 stars + 
  optional comment. One feedback per user per event.
- Attendees can upload photos to the event gallery. Photos require 
  host approval before appearing publicly.
- Anyone can report an event or a photo via the Report button. 
  Reported items appear in the host's moderation queue and can be hidden.
- Hosts can export attendance to CSV from Dashboard → event → Export CSV.

## Roles

- **Host:** full access to events, members, moderation, exports.
- **Checker:** check-in only — cannot access dashboard, editor, 
  or exports.

## Tech stack

- React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, Auth, Storage, Row Level Security)
- Built and deployed via Lovable

## Project structure

The source code lives at the root of this repository.
The `task-2/` folder contains task-specific deliverables:
- This README (usage guide)
- `report.md` — development notes
- `sample-export.csv` — example CSV export
