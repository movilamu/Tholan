# Tholan

Tholan is a bilingual English/Tamil health monitoring and emergency-response application built for Next.js App Router, Supabase, Groq, Leaflet/OpenStreetMap, Nominatim, and OSRM.

## Required environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GROQ_API_KEY=
```

The SQL migration in `supabase/migrations/001_initial.sql` creates the application schema, RLS policies, the signup profile trigger, and the private `medical-records` Storage bucket/policies.

## Google OAuth redirect

Google sign-in uses the PKCE callback route `https://YOUR_DOMAIN/auth/callback`. In Supabase Dashboard → Authentication → URL Configuration, the Site URL should be your deployed domain and that callback URL should be included in Additional Redirect URLs. The callback exchanges the OAuth code on the server before redirecting to `/` or `/signup-essentials`, preventing the common post-Google bounce back to `/login`.

## Safety behavior

- Medication data can only be inserted after extraction from a real uploaded record and explicit user approval.
- Chat is medical/symptom-only and must not prescribe or recommend medication or dosage.
- Hospital notification is always `SIMULATED — NOT SENT`.
- Ambulance/hospital/contact calling uses native `tel:` links.
- Emergency-contact notification uses native `sms:` with a prefilled message.
- First-aid content is labeled `Guidance based on WHO-type sources — verify before production use.`

## Groq model compatibility

The brief names `llama-3.1-8b-instant` for chat. Groq's current documentation lists that model as deprecated for free/developer-tier usage as of August 16, 2026, with `openai/gpt-oss-20b` as its recommended replacement. Tholan therefore uses `openai/gpt-oss-20b` for chat to remain deployable on the current Groq catalog. Document image extraction uses Groq's current vision-capable `qwen/qwen3.6-27b` model. Speech-to-text uses `whisper-large-v3`.

## Run

```bash
npm install
npm run dev
```

For production:

```bash
npm run build
npm start
```
