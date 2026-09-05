# DX LMS marketing assets

Brand and marketing assets used by the DX LMS interface.

## September 2026 UI simplification

`illustrations/learning-together-v2.png` is the selected 1448 × 1086 built-in ImageGen asset for the simplified home hero. Brief: a premium soft-3D Vietnamese teacher with glasses guiding two students at a light wooden desk with books, pencil and laptop; natural hands, bright white background, navy/blue clothing, no text, labels, logo, UI cards or watermark. The illustration supplies the human learning moment; all product copy, buttons, and status remain accessible native HTML. Original generated source is retained separately. Version 1 is preserved, not overwritten.

The selected section concepts use a white/navy/cobalt system, compact navigation, an open feature tab layout, three aligned onboarding steps, three paid plans, editorial article images, and a single-action CTA band. The official origami dolphin mark is preserved instead of the illustrative concept's invented dolphin logo. The 3D education style and bounded stationery motion follow the user's graphic request; these are intentional differences from the photo-like hero concept. The guidebook CTA asset below is retained for history but no longer rendered in the primary footer CTA.

## Files

- `blog/learning-path-v2.webp`: a teacher guiding a student through her workbook and learning plan.
- `blog/blended-class-v2.webp`: two learners studying together with their teacher visible in an online lesson.
- `blog/teaching-workflow-v2.webp`: two coordinators reviewing a teaching folder beside a laptop and calendar.

These three September 2026 built-in ImageGen illustrations replace the first three featured covers without deleting the originals. Full generated size is 1586 × 992, exported as WebP at quality 85 without cropping. Shared brief: polished editorial Vietnamese education scene, expressive natural people, bright window light, white/navy/blue materials, clear human interaction, no readable text, branding, watermarks, floating dashboards or glowing UI. Subject variations are described above. The returned photo-like treatment follows the editorial section concept; these are illustrative people, not customer photographs or testimonials.

- `brand/dolphinx-dolphin-mark-192.webp`: official transparent DolphinX mark, vendored from `dolphinxstudio.com` so the product does not hotlink an optimizer endpoint.
- `og/dx-lms-og.svg`: 1200 × 630 social-sharing artwork. It references the official local DolphinX mark and uses live SVG text.
- `illustrations/lms-guides-v2.png`: 1536 × 1024 transparent guidebook illustration generated with the built-in ImageGen tool on 2026-09-04. Retained as a legacy decorative asset; the simplified primary CTA no longer renders it. Text and links remain native, localized HTML.
- `illustrations/learning-together-v1.png`: 1448 × 1086 education scene, generated with the built-in ImageGen tool. A teacher guides two students using books and a laptop. The pale-blue background blends at the outer edges; the image has no UI text and receives localized alt text.
- `illustrations/pencil-v1.png`, `illustrations/ruler-v1.png`, `illustrations/eraser-v1.png`: separate 1254 × 1254 transparent stationery assets from the same concept. Decorative, pointer-transparent, with a short entrance movement and a static reduced-motion presentation.
- `blog/*.webp`: ten existing, distinct educational illustrations mapped through `MarketingBlogPost.hero`. `ArticleCover` uses these same images for homepage cards, blog search results, article heroes, and related articles. Images contain no localized UI labels; all titles and categories remain native HTML.

### Learning scene and stationery briefs

Built-in ImageGen was used, not an API/CLI fallback. The scene brief: a friendly Vietnamese female teacher in a light-blue blazer and glasses guiding a boy and girl in white-and-blue school clothes, studying around a light-wood desk with open workbooks, a laptop and a blue notebook; polished soft 3D, natural hands, entire group visible, clean pale-blue background, no words, logo, UI, or floating props. A matching pale background was selected after the initial transparency extraction returned an opaque checkerboard; those rejected versions are not used.

Three separate prop briefs: a yellow wooden pencil with blue ferrule and coral eraser cap; a translucent cyan triangular ruler with white tick marks; and a coral eraser with a white paper sleeve. Each is a single centered object, softly lit, with genuine alpha transparency and no branding or text. The original generated files are retained outside this repository.

### Guidebook illustration brief

One open learning guidebook, white paper layers, cobalt blue cover (`#0068D9`), navy details (`#062347`) and cyan bookmark (`#12BFE2`). Restrained three-quarter 3D paper illustration with checklist marks and short typographic rules, no readable text, letters, numbers, logo, people or floating cards. Entire book visible with safe padding, transparent alpha background and subtle contact shadow; recognizable at 300–380px on the pale-blue CTA surface. Generated source is retained separately; this project copy is served through Next Image with responsive sizes.

The UI combines the official mark with a DOM text lockup (`DX LMS`, optionally `by DolphinX Studio`) so the name remains crisp and accessible at every size. The older generated mark and wordmark SVGs are retained only as legacy files and must not be used in active screens.

## Palette

- Navy: `#052757`
- Primary blue: `#0068D9`
- Cyan: `#12BFE2`
- Aqua: `#9DEFF2`
- Muted blue: `#536981`
- Pale surface: `#F2F8FB`

Keep the official logo aspect ratio intact and provide useful surrounding whitespace. Decorative usage should use an empty HTML `alt` value; meaningful brand placements should expose the `DX LMS` name.
