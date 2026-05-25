# Development Report — Find Your Gather

## Tools and techniques

- **Lovable AI** was the primary development environment. Code was 
  generated and iterated through focused, scoped prompts rather than 
  one large mega-prompt.
- The build was split into focused phases:
  1. Foundation — auth, database schema, Explore, event editor
  2. RSVP system — tickets, QR codes, waitlist with auto-promotion
  3. Roles and check-in — invitations, member roles, check-in page
  4. Community features — gallery moderation, feedback, reports, CSV
  5. Polish — seed data, social meta tags, validation, mobile fixes
- **Supabase** provided Auth, Postgres, Storage, and Row Level Security.
- **shadcn/ui + Tailwind CSS** for a consistent UI layer with minimal 
  custom styling.

## What worked well

- Splitting work into focused prompts gave noticeably better results 
  than describing all features at once. Lovable preserved existing 
  code and added cleanly to it.
- Supabase Row Level Security let permission rules be expressed 
  declaratively rather than checked in application code, which kept 
  the frontend simpler.
- Generating each ticket with both a visual QR code and a short text 
  code solved the "no camera scanning required" requirement neatly — 
  the same code can be typed manually at check-in.
- The seed data made the deployed app immediately usable for review, 
  rather than appearing empty on first load.

## What did not work / required extra rounds

- The first version of invitation links pointed to a fallback domain 
  instead of the current deployment. Fixing it required explicitly 
  telling Lovable to use `window.location.origin`.
- Waitlist auto-promotion initially only happened when the next person 
  loaded the page. It had to be re-implemented as a Postgres trigger 
  so that promotion fires immediately on cancellation.
- CSV exports initially had broken encoding for non-Latin characters 
  in Excel — fixed by encoding as UTF-8 with a BOM prefix.
- Timezone handling for events is functional but basic — events are 
  saved and shown in the creator's local timezone with the timezone 
  string stored alongside.

## Notable decisions

- **Manual check-in only.** The brief explicitly stated that camera 
  scanning is not required. Codes are short alphanumeric strings shown 
  under each QR, making manual entry quick.
- **Waitlist promotion via DB trigger,** not client-side logic — 
  this guarantees consistency regardless of the user path that 
  triggered the cancellation.
- **Hidden flag for moderation** rather than hard delete — keeps an 
  audit trail and allows un-hiding if a report turns out to be invalid.
- **Free/Paid toggle exists in the UI with Paid disabled,** as the 
  spec requested, so the path to monetization is visible to hosts 
  even though paid events are not yet supported.
- **Feedback gate uses the event's `ends_at` server-side**, not just 
  UI hiding, so it cannot be bypassed by manipulating the frontend.

## Known limitations

- Real-time counters on the check-in page update on action, but 
  cross-device live sync is not implemented.
- Mobile layout has been tested at 375px width but not extensively 
  on all devices.
- Email notifications (e.g. waitlist promotion notice via email) 
  are not implemented — users see the change in-app on their next 
  visit.
