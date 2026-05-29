# Category Sub-Items Config — for Expensed Team

## Firebase Path

```
/config/categorySubs
```

Under shared project `ainvested-703ec`, same Realtime Database as SPENT/Invested.

## Data Format

A flat object keyed by category name. Each value is an array of sub-item strings:

```json
{
  "Food & Dining": ["Lunch", "Dinner", "Supper", "Snack", "Breakfast", "Teh", "Kopi"],
  "Groceries": ["Weekly Top-up", "Bulk", "Emergency", "99 Speedmart"],
  "Transport": ["Fuel", "Toll", "Parking", "Grab", "Public", "JPJ"],
  "Shopping": ["Online", "Mall", "Essentials", "Big Purchase"],
  "Utilities": ["TNB", "Unifi", "Water", "Phone", "Astro"],
  "Entertainment": ["Streaming", "Gaming", "Cinema", "Outing"],
  "Health & Wellness": ["Clinic", "Pharmacy", "Gym", "Supplement"],
  "Home": ["Maintenance", "Renovation", "Furniture", "Cleaning"],
  "Others": []
}
```

## Write Permissions

**Write:** Expensed writes this path via Firebase Admin SDK or a Cloud Function. The RTDB rule grants write access only to Firebase Admin (no public write). How Expensed chooses to gate this (settings UI, sync on login, etc.) is up to you.

**Read:** Any authenticated Firebase user can read it. SPENT reads it on each add-screen open.

## Behavior

- `"Others": []` — empty array means no sub-chips, skipping level 2 entirely.
- Any category omitted from the object = no sub-chips (treated same as empty array).
- Category keys must EXACTLY match the categories used by SPENT: `Food & Dining`, `Groceries`, `Transport`, `Shopping`, `Utilities`, `Entertainment`, `Health & Wellness`, `Home`, `Others`.

## SPENT Fallback

If `/config/categorySubs` is null or absent from Firebase, SPENT falls back to the defaults listed above. This means SPENT works out of the box with no Expensed dependency.

## RTDB Rule Requirement

Add this block to Firebase RTDB rules:

```json
"config": {
  ".read": "auth != null",
  ".write": false
}
```

This lets any authenticated user read config. Write is blocked from the client — Expensed must write via Admin SDK from a trusted environment.
