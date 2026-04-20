/**
 * Schema for the admin CMS editor.
 *
 * Lists every content key Haley can edit, organized into visible groups.
 * The public pages read the same keys via useContent(key, fallback) — the
 * fallback is whatever today's hardcoded copy shows, so an unset key
 * renders identically to before this sub-project shipped.
 *
 * To add a new editable string:
 *   1. Add the key to this schema with an appropriate `type`.
 *   2. On the public page, swap the literal for `useContent("my.key", "fallback")`.
 *   3. Admin sees the key in /admin/content immediately.
 */

export type ContentKeyType = "text" | "textarea" | "json";

export interface ContentKeySpec {
  key: string;
  label: string;
  type: ContentKeyType;
  /** Used on the JSON type to describe the expected shape in the UI */
  hint?: string;
}

export interface ContentGroup {
  title: string;
  description?: string;
  keys: ContentKeySpec[];
}

export const CONTENT_SCHEMA: ContentGroup[] = [
  {
    title: "Home — Hero",
    description: "The big headline at the top of the homepage.",
    keys: [
      { key: "hero.title", label: "Title", type: "text" },
      { key: "hero.subtitle", label: "Subtitle", type: "textarea" },
      { key: "hero.cta_primary", label: "Primary button label", type: "text" },
      { key: "hero.cta_secondary", label: "Secondary button label", type: "text" },
    ],
  },
  {
    title: "Home — Testimonials",
    description: "The rotating quote carousel. JSON array of quote objects.",
    keys: [
      {
        key: "home.testimonials",
        label: "Testimonials",
        type: "json",
        hint: `[{ "quote": "...", "author": "...", "role": "..." }, ...]`,
      },
    ],
  },
  {
    title: "About",
    keys: [
      { key: "about.title", label: "Page title", type: "text" },
      { key: "about.hero_subtitle", label: "Hero subtitle", type: "text" },
      { key: "about.story", label: "Full story (plain text)", type: "textarea" },
    ],
  },
  {
    title: "Trainers",
    description: "Haley's story + other trainer profiles. JSON array.",
    keys: [
      {
        key: "trainers",
        label: "Trainer profiles",
        type: "json",
        hint: `[{ "name": "...", "role": "...", "bio": "...", "image_key": "about.haley1" }, ...]`,
      },
    ],
  },
  {
    title: "Reviews",
    description: "Customer testimonials on the /reviews page.",
    keys: [
      {
        key: "reviews",
        label: "Reviews",
        type: "json",
        hint: `[{ "quote": "...", "author": "...", "stars": 5 }, ...]`,
      },
    ],
  },
  {
    title: "Contact",
    keys: [
      { key: "contact.email", label: "Email", type: "text" },
      { key: "contact.phone", label: "Phone", type: "text" },
      { key: "contact.address", label: "Address", type: "text" },
      { key: "contact.hours", label: "Business hours", type: "textarea" },
      {
        key: "contact.social",
        label: "Social links",
        type: "json",
        hint: `{ "instagram": "...", "tiktok": "...", "facebook": "..." }`,
      },
    ],
  },
  {
    title: "Ambassador program",
    keys: [
      { key: "ambassador.title", label: "Title", type: "text" },
      { key: "ambassador.tagline", label: "Tagline", type: "text" },
      { key: "ambassador.description", label: "Description", type: "textarea" },
    ],
  },
  {
    title: "Footer",
    keys: [
      { key: "footer.tagline", label: "Tagline", type: "text" },
      { key: "footer.copyright", label: "Copyright line", type: "text" },
    ],
  },
];
