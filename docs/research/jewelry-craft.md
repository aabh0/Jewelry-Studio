# Jewelry Campaign Visual Craft — Research for Presets, Taxonomies, Prompt Templates and QA

Date: 2026-10-14. Purpose: give a developer enough concrete, enumerable material to encode jewelry campaign craft into an AI image/video generation app (Higgsfield Soul, Nano Banana Pro, Seedream, Kling 3, Seedance 2).

**Method and confidence.** Sources were gathered via web search only; direct page fetches were blocked in this sandbox (DNS resolution failed for WebFetch and curl), so figures come from search-result summaries of the linked pages plus standard jewelry-trade conventions. Every section marks items as:

- `[S]` sourced from a linked page in this session
- `[C]` standard trade convention / domain knowledge, not verified against a page this session — reasonable to encode but worth a spot check
- `[?]` sources conflict or the claim is a vendor's marketing claim — encode as a default, expose as user-editable, or verify before relying on it

Most AI-tool guidance online is written by vendors of AI tools; it is treated as practitioner advice, not independent test data.

---

## 1. Jewelry type taxonomy

### 1.1 Top-level categories (enum `jewelry_category`)

`ring | necklace | earring | bracelet | brooch | anklet | body_jewelry | watch | cufflink`

### 1.2 Rings

Worn on a finger. Western convention places engagement/wedding rings on the left ring (fourth) finger, wedding band stacked beneath the engagement ring; several cultures (Eastern Europe, Russia, India) use the right hand `[S]` ([Gabriel NY](https://www.gabrielny.com/blog/finger-rings-and-meaning/), [Borsheims](https://www.borsheims.com/blog/what-fingers-to-wear-rings-on/)). Index finger reads as "statement/authority", pinky as signet/fashion `[S]` ([Azeera](https://www.azeera.com/blog/symbolic-ring-placement-know-the-meaning-behind-each-finger/)). Encode `finger` as an explicit field: `left|right` × `thumb|index|middle|ring|pinky`, default `left.ring` for bridal, `right.index|middle` for fashion/cocktail, `pinky` for signet.

| Subtype | What it is | Best framing | Real-world dimensions |
|---|---|---|---|
| `solitaire` | Single center stone, usually prong-set | 45° three-quarter ("hero angle") showing band profile + setting depth; macro top-down for the stone; hand close-up for scale `[S]` ([Squareshot](https://www.squareshot.com/post/jewelry-photography-angles-for-clear-detail-rich-shots)) | Center stone 0.25–3 ct (round: ~4.1 / 5.1 / 6.5 / 8.2 mm for 0.25 / 0.5 / 1 / 2 ct) `[S]` ([StoneAlgo](https://www.stonealgo.com/blog/diamond-size-chart/), [Stuller](https://blog.stuller.com/wp-content/uploads/2025/05/MM-CT-Chart.pdf)); band 1.5–2.5 mm |
| `band` (plain/wedding) | Continuous metal band | Stacked on hand, or standing on edge at 45° | Women 1.5–4 mm (most popular 2.5–3 mm); men 5–6 mm most popular, 8 mm+ "bold" `[S]` ([Brilliant Earth](https://www.brilliantearth.com/guides/ring-width-chart/), [Glamira](https://www.glamira.co.za/blog/post/wedding-band-width-guide)); thickness ≥1.4 mm so it does not look flimsy `[S]` |
| `eternity` | Stones set all the way around (full) or front 40–50% (half); ¾ has small plain bar `[S]` ([Liori](https://lioridiamonds.com/blogs/news/diamond-eternity-bands-explained-full-vs-half-by-metal-cost)) | Profile/edge-on to show continuous stones; stacked with solitaire | ~2.1 mm width for 26 × 0.04–0.05 ct stones `[S]` ([Washington Diamond](https://washingtondiamond.com/blogs/the-diamond-editorial/2-ct-eternity-band-guide-2026)); per-stone 1.5–3 mm `[C]` |
| `signet` | Flat engravable face | Top-down on face, or hand resting on surface so face reads to camera; pinky or index | Face: small 10–14 mm, medium 15–18 mm, large 19–25 mm; ovals 10×12 to 13×16 mm; pinky 8×10–10×12 mm `[S]` ([Robinsons](https://robinsonsjewelers.com/blogs/news/signet-rings-how-to-choose-the-right-face-size-for-your-hand-a-guide-that-wont-leave-you-feeling-ring-shamed), [AJ Luxe](https://ajluxe.com/blogs/jewelry-guide/how-to-choose-a-signet-ring)) |
| `cocktail` | Large colored center stone / cluster | Hand near face or collarbone; low side angle to show height | Face 15–25 mm+ `[C]`; center stones 3–10 ct `[C]` |
| `stackable` | Thin bands designed to be worn in sets | Hand with 2–4 rings across fingers; top-down flat lay in a row | 1–2 mm each `[C]` |
| `halo` | Center stone ringed by small stones | Top-down macro (halo reads best face-up) | Halo melee 1–1.5 mm `[C]` |
| `three_stone`, `cluster`, `dome`, `chevron/curved` (optional subtypes) | | | |

Scale references `[C]`: adult finger width at the base ≈ 15–20 mm; US ring size 6 ≈ 16.5 mm inner diameter, size 7 ≈ 17.3 mm, men's size 10 ≈ 19.8 mm. Use these so a "stone 6.5 mm on size-6 finger" renders in proportion.

### 1.3 Necklaces

Chain lengths and where they sit `[S]` ([Brilliant Earth](https://www.brilliantearth.com/news/necklace-length/), [Bluestone](https://blog.bluestone.com/jewellery-sizes-explained-with-numbers-ring-size-chain-length-bangle-diameter/), [Jewelove](https://www.jewelove.in/blogs/jewelove-blog/chain-size-chart)); style names are trade convention `[C]`. Note guides disagree by one step on 14" vs 16" (some call 16" the "collar") and body size shifts placement `[?]`.

| Length | Trade name | Sits at (average adult woman) | Framing |
|---|---|---|---|
| 12–14 in | collar / choker | tight at base of neck | tight neck crop, chin to collarbone |
| 16 in | choker | base of throat / just above collarbone | neck crop |
| 18 in | princess (most common) | on the collarbone | head-and-shoulders or neck-to-décolletage |
| 20 in | princess/matinee | just below collarbone | shoulders-to-bust crop |
| 22–24 in | matinee | top of bust / sternum | mid-torso crop |
| 28–30 in | opera | mid-chest | waist-up |
| 36 in+ | rope / lariat-length | below bust, often doubled | three-quarter body |

Men's chains commonly 20–24 in `[S]` ([Virage London](https://www.viragelondon.com/blogs/news/what-necklace-length-should-you-buy-the-ultimate-guide-to-16-18-20-22-24-or-30-inch-necklace-on-man)).

| Subtype | What it is | Framing / notes | Dimensions |
|---|---|---|---|
| `pendant` | Charm/stone on chain | Décolletage crop; collarbone area clearly lit; overhead angle for drape `[S]` ([Branvas](https://branvas.com/blogs/news/jewelry-product-photography-checklist)) | Small 8–12 mm, medium 15–25 mm, statement 30 mm+ `[C]`; bail 3–6 mm `[C]` |
| `chain` | Chain alone (cable, curb, rope, box, figaro, paperclip, snake, herringbone, rolo) | Neck crop; macro on links | Width 1–2 mm fine, 3–5 mm medium, 6 mm+ chunky `[C]` |
| `choker` | 14–16 in, sits at base of neck | Tight neck crop, chin visible | — |
| `lariat` / Y-necklace | Open-ended drop or Y-shape | Longer torso crop to show the drop | Drop 50–150 mm `[C]` |
| `station` | Stones/beads spaced along chain | Décolletage to show spacing | Stations 3–6 mm `[C]` |
| `collar` | Rigid or wide piece hugging neck | Frontal neck crop, straight-on | Width 10–40 mm `[C]` |
| `tennis_necklace` | Continuous line of stones | Neck crop, slightly raised chin | 2–4 mm stones `[S]` ([Liori](https://lioridiamonds.com/blogs/news/tennis-necklace-carat-size-guide)) |
| `layered` | 2–4 chains at different lengths | 16/18/20 in step pattern; torso crop | — |

Clasps (enum `clasp`): `lobster | spring_ring | toggle | box | magnetic | barrel | hook | slide` `[C]`. Ghost-mannequin and packshot shots usually hide the clasp at back; macro "trust shots" show it.

### 1.4 Earrings

| Subtype | How worn | Framing | Dimensions |
|---|---|---|---|
| `stud` | Post through lobe, sits flat | Profile or ¾ face crop, hair tucked behind ear `[S]` ([Photta](https://www.photta.app/tools/on-model-jewelry-photography)) | Mini 2–4 mm, standard 5–8 mm, large 9–12 mm `[S]` ([The Jewellery Room](https://thejewelleryroom.com/pages/size-guide-earrings), [Clean Origin](https://www.cleanorigin.com/blog/earring-size-chart-for-studs-and-hoops/)) |
| `huggie` | Small hinged hoop hugging the lobe | Tight ear/jaw crop | 8–15 mm inner diameter `[S]` ([Baby Gold](https://www.babygold.com/blogs/all-things-baby-gold/hoops-and-huggies-size-guide)) |
| `hoop` | Circle through lobe | Profile for diameter; ¾ for thickness | Small 12–20 mm, medium 20–35/40 mm, large 40–60 mm, statement 60 mm+; thickness 1.5–4 mm changes look at same diameter `[S]` ([Blue Nile](https://www.bluenile.com/blog/fashion/hoop-earring-sizes), [Frank Jewelers](https://www.frankjewelers.com/blogs/blog/best-hoop-earrings-how-to-choose)) `[?]` boundaries vary by guide |
| `drop` / dangle | Hangs from hook/post | Profile with movement (hair back) | Short 20–40 mm, mid 40–60 mm, long 70–90 mm (reaches jawline) `[S]` ([Theo Grace](https://www.theograce.com/a/blog/-how-to-measure-earring-size-a-complete-guide)) |
| `chandelier` | Multi-tier drop | Profile or frontal, neck visible | 50–100 mm `[C]` |
| `ear_cuff` | Clips to cartilage, no piercing | Tight profile crop on upper ear | 12–16 mm diameter typical `[S]` ([Maison Miru](https://maisonmiru.com/products/eternity-ear-cuff)) |
| `climber` / crawler | Enters at lobe piercing, runs up the ear | Profile | ~20 mm typical, up to 70 mm `[S]` ([Etsy listing](https://www.etsy.com/listing/288698857)) |
| `threader`, `jacket`, `clip_on` (optional) | | | |

Backs (enum `earring_back`): `butterfly | screw | lever | latch | french_hook | hinged` `[C]`.

### 1.5 Bracelets

| Subtype | Framing | Dimensions |
|---|---|---|
| `tennis` | Wrist close-up, stones face-up; add ½–¾ in to wrist `[S]` ([Kay](https://www.kaysfinejewelry.com/pages/bracelets-bangles-size-guide-find-your-perfect-fit)) | 1 cttw ≈ 2.1 mm wide (67–80 stones), 2 cttw ≈ 2.8 mm, 3 cttw ≈ 3.2 mm `[S]` ([Brilliant Earth](https://www.brilliantearth.com/guides/tennis-bracelet-carat-comparison/)); 1.5–2.5 mm per stone `[S]` ([USA Jewels](https://www.usajewels.com/blog/?p=219)) `[?]` counts differ by source |
| `bangle` | Slides over hand; rigid; wrist/forearm crop, often stacked | Petite 15 cm, medium 17 cm, large 18 cm circumference `[S]` (Kay); ≈ 60–65 mm inner diameter `[C]` |
| `cuff` | Open rigid band, gap at inside wrist | Wrist crop showing gap | Inner length ≈ wrist − 1 in; gap 25–38 mm `[S]` ([Love & Co](https://love-and-co.com/blogs/news/bangle-and-bracelet-size-guide)); width 10–40 mm `[C]` |
| `chain` | Flexible link | Wrist with hand relaxed | 7 in women's standard, 8 in men's `[S]` (Kay, [Perfect Corp](https://www.perfectcorp.com/business/blog/general/bracelet-size-chart)) |
| `charm` | Chain with hanging charms | Wrist, slight motion blur acceptable | Charms 8–20 mm `[C]` |
| `beaded`, `cord`, `id_bar` (optional) | | |

### 1.6 Other categories

- **Brooch / pin**: worn on lapel, collar, shoulder, hat band, or on a scarf; framing: chest/shoulder crop with garment texture; 25–60 mm typical `[C]`.
- **Anklet**: 9–10 in for ankle 8.5–9 in, 10.5–11.5 in for larger `[S]` ([Juwelenn](https://jewellery-brand1.odoo.com/size-guide)); framing: lower leg/foot, sandals, sand/water contexts.
- **Body jewelry**: nose stud (1.5–3 mm head), septum ring (8–10 mm), navel bar (14 g, 10 mm bar), cartilage studs; gauge → mm: 20 g 0.8, 18 g 1.0, 16 g 1.2, 14 g 1.6 `[C]`. Framing: tight facial or midriff crops.
- **Watch**: case <34 mm small, 34–38 midsize, 39–42 standard, 43–46 XL, 47+ XXL `[S]` ([Zales](https://www.zales.com/size-guide)). Convention: hands at 10:10 for symmetry and logo visibility (brands may specify) `[S]` ([PetaPixel](https://petapixel.com/2013/06/27/why-photographs-of-watches-and-clocks-show-the-time-1010), [DIY Photography](https://www.diyphotography.net/?p=188347)); 45° camera for dial relief, flat overhead for clasp/crown macro, focus-stack `[S]` ([Packshot Creator](https://packshot-creator.com/en/guide/how-to-position-watch-before-shooting-photo), [Broncolor](https://broncolor.swiss/news/how-to-photographing-a-watch)). Framing: wrist with cuff, or standing on strap.
- **Cufflinks**: worn through French cuff; framing: wrist/cuff crop with jacket sleeve pushed back, or pair on a flat surface. Face ≈ 15–20 mm `[C]` (no source found this session).

### 1.7 Materials (enum `metal`)

`yellow_gold | white_gold | rose_gold | platinum | sterling_silver | vermeil | gold_plated | gold_filled | titanium | stainless_steel | enamel | mixed_metal`

Rendering notes a prompt generator should attach:
- Yellow gold needs warm, environment-driven reflections or it reads as brass; white gold without careful highlights is indistinguishable from silver/platinum in photos `[S]` ([Nightjar](https://nightjar.so/help-desk/how-do-i-make-jewelry-or-metal-products-look-realistic-in-ai-images)). Encode karat (10/14/18/22/24k) and finish (`high_polish | satin | brushed | hammered | matte | sandblast | florentine`) separately; 24k reads deeper orange-yellow, 14k paler `[C]`.
- Rose gold is a gold–copper alloy with a pink hue `[S]` ([Antique Jewellery Co](https://www.antiquejewellerycompany.com/choosing-jewellery-to-match-your-skin-tone/)).
- Rhodium-plated white gold and platinum are bright, cool, near-mirror; grey (not pure white) surroundings prevent blown highlights `[S]` ([SkyJems](https://skyjems.ca/pages/encyclopedia-photo-cube)).
- Enamel: opaque or translucent colored glass over metal; needs cross-polarization or diffused light to avoid glare `[S]` ([Alan Ranger](https://www.alanranger.com/blog-on-photography/how-to-photograph-jewelry)).

### 1.8 Gemstones

**Diamond shapes** (enum `stone_shape`): `round_brilliant | princess | cushion | oval | emerald | asscher | radiant | pear | marquise | heart | baguette | trillion | rose_cut | old_european`. Brilliant cuts (round, pear, princess, oval, cushion, radiant, marquise) sparkle with many small facets; step cuts (emerald, asscher, baguette) show broad "hall of mirrors" flashes and need cleaner, larger light sources `[S]` ([GIA 4Cs](https://4cs.gia.edu/?p=38048)).

Round brilliant carat → diameter (approx., varies with cut) `[S]` (StoneAlgo, Stuller): 0.05 ct 2.4 mm · 0.10 ct 3.0 mm · 0.25 ct 4.1 mm · 0.50 ct 5.0–5.1 mm · 0.75 ct 5.8 mm · 1.0 ct 6.4–6.5 mm · 1.5 ct 7.4 mm · 2.0 ct 8.1–8.2 mm · 3.0 ct 9.3 mm. Ovals/marquise are longer for the same weight. Melee/pavé stones 0.8–2.0 mm `[C]`.

**Colored stones** (enum `stone_type`): `diamond | lab_diamond | moissanite | sapphire | ruby | emerald | aquamarine | morganite | tanzanite | amethyst | citrine | garnet | peridot | topaz | tourmaline | opal | turquoise | lapis | onyx | moonstone | labradorite | spinel | alexandrite | jade | pearl | cubic_zirconia`. Attributes: `color_hue`, `saturation`, `tone`, `transparency (transparent|translucent|opaque)`, `cut (faceted|cabochon|rose|bead|carved)`.

**Pearls**: `akoya | freshwater | south_sea | tahitian | baroque | keshi`; sizes 6–8 mm (akoya classic), 9–14 mm (south sea), baroque irregular `[C]`. Attributes: luster, overtone (rose/silver/cream/green), orient.

### 1.9 Settings (enum `setting`)

`prong (4|6|8 claws) | bezel | half_bezel | pave | micro_pave | channel | bar | halo | double_halo | tension | flush/gypsy | cluster | invisible | bead | cathedral | basket | trellis` `[S]` ([Leibish](https://leibish.com/ultimate-guide-to-engagement-rings-article-807), [Whiteflash](https://www.whiteflash.com/blog/different-types-of-engagement-rings/)). Prong count is a known AI failure point (4→6 prong drift), so it must be an explicit, required field for prong-set pieces.

### 1.10 Suggested JSON shape

```json
{
  "category": "ring",
  "subtype": "solitaire",
  "metal": {"type": "yellow_gold", "karat": 18, "finish": "high_polish"},
  "stones": [{"role": "center", "type": "diamond", "shape": "oval", "carat": 1.5, "mm": [9.0, 6.5], "color": "near_colorless"}],
  "setting": {"type": "prong", "prong_count": 4, "halo": false},
  "dimensions": {"band_width_mm": 2.0, "band_thickness_mm": 1.6},
  "wear": {"hand": "left", "finger": "ring", "stack_position": 1},
  "reference_images": ["front.jpg", "three_quarter.jpg", "profile.jpg", "macro_stone.jpg"]
}
```

---

## 2. Campaign visual formats

Each format below gives composition conventions and a typical shot list. Most sources are practitioner/vendor blogs; shot lists are consolidated from [Branvas 8-image checklist](https://branvas.com/blogs/news/jewelry-product-photography-checklist), [Squareshot](https://www.squareshot.com/post/the-complete-guide-to-product-photography-angles), [Photta Shopify guide](https://www.photta.app/blog/shopify-jewelry-photography-guide-conversion), [Format flat-lay guide](https://www.format.com/magazine/flat-lay-photography-guide), [Grown Brilliance unboxing](https://www.grownbrilliance.com/blog/jewelry-unboxing-rituals-how-to-capture-the-magic-for-social-media/), [National Jeweler reveals](https://www.nationaljeweler.com/articles/14532-beyond-unboxing-creative-reveals-to-drive-reach-and-engagement) and trade convention `[C]`.

| Format (enum `format`) | Composition conventions | Typical shot list |
|---|---|---|
| `packshot_white` (e-commerce) | Seamless white (RGB 255 or 245–250 with soft contact shadow), piece centered, fills 60–80% of frame, no props, true color, f/8–f/16 or focus-stacked, 85–105 mm macro `[S]`; rings on a ring cone or standing, earrings on T-bar or floating as a pair, necklaces on ghost bust or laid in a soft curve | 1 front/hero · 2 three-quarter 45° · 3 profile/side · 4 back (clasp/post) · 5 macro detail · 6 scale shot (on hand/ear/neck or next to coin/ruler) · 7 pair/set shot · 8 packaging |
| `hero_still_life` | Negative space, single hero object, monochrome or two-tone palette, textured surface (marble, stone, silk, velvet, water, sand), directional low-key or window light, often tilted 15–30° for depth; leave room for copy `[S]` ([Robinsons](https://robinsonsjewelers.com/blogs/news/how-to-photograph-your-jewelry-for-instagram-like-a-pro-a-complete-guide-to-sparkle-shine-swoon-worthy-shots)) | Wide with props · tight hero · macro texture · variant with copy space left/right/top |
| `macro_detail` | 1:1 or greater magnification, 100 mm macro, f/11–f/16 or stack; subject: stone facets, prongs, pavé, engraving, clasp, hallmark; shallow DOF variants for mood | Stone top-down · prong/setting ¾ · pavé rail · engraving · clasp |
| `on_model_beauty_crop` | Tight crops: ears (profile/¾, hair tucked back), neck/décolletage (chin visible, collarbone lit), hands (relaxed fingers, slight palm turn, hand tilted toward camera), wrist (forearm diagonal). Shallow DOF on skin, product sharp. Skin even, neutral nails `[S]` ([Photta](https://www.photta.app/tools/on-model-jewelry-photography), [Photofocus hands](https://photofocus.com/photography/fingers-and-forms-5-tips-for-posing-hands/), [soona hand poses](https://collectivehub.soona.co/models/human-models/hand-modeling/hand-model-pose-guide)) | Profile ear · ¾ ear with jaw · neck frontal · décolletage ¾ · hand-at-face · hand on surface · hand-on-hand · wrist raised |
| `lifestyle_editorial` | Full or half-body, environment tells story (city, home, beach, atelier), natural or golden-hour light, product still legible (≥ 3–5% of frame) `[C]`; fashion-magazine pacing | Establishing wide · medium with gesture · tight beauty crop · detail macro · candid/motion |
| `flat_lay` | Camera straight down, props chosen to read from above, remove one prop when in doubt, mood decided before props, tonal palette, negative space for text `[S]` ([Format](https://www.format.com/magazine/flat-lay-photography-guide), [Cristy Cross](https://cristycross.com/blog/2019/5/29/10-tips-for-styling-a-successful-flat-lay-for-instagram)) | Full lay · tight lay · grid/collection lay · with packaging · with hand entering frame |
| `ghost_mannequin` / invisible bust | Necklace or bracelet on a neutral bust/form, form retouched out; straight-on and high ¾; shows drape and length `[S]` ([Branvas](https://branvas.com/blogs/news/jewelry-product-photography-checklist)) | Straight-on · high ¾ left/right · close-up pendant · back/clasp |
| `hand_model` | Poses: relaxed fingers, palm slightly toward camera, avoid flat back of hand, tilt up to avoid stubby fingers; "texting hands", "hand over hand", "overturned hand", holding object (cup, flower, fabric), ring turned to camera; do not cover product with fingers `[S]` (soona, [Lemon8 nail poses](https://www.lemon8-app.com/@stateofnails/7284251482554450437?region=ca)) | Hand resting on surface · hand at collarbone · hands clasped · holding prop · two hands stacking rings · wrist + ring together |
| `couples_gifting` | Two sets of hands, box being opened or handed over, ring placed on finger, soft warm light, shallow DOF, eye-level or overhead; bridal uses white roses/lace/soft textiles vs. editorial B&W city settings `[S]` ([Prohibition PR / Sylvie](https://prohibitionpr.co.uk/digital-marketing/social-media/social-media-advertising/goldsmiths-2019-bridal-campaign-the-perfect-match/), [JCK / Lagerfeld](https://www.jckonline.com/editorial-article/karl-lagerfeld-reveals-new-bridal-and-engagement-campaign)) | Box reveal · placing on finger · hands intertwined · embrace with product visible · reaction |
| `seasonal` | See table below | |
| `social_ugc_tryon` | 9:16, handheld/selfie feel, creator fastening/adjusting pieces, GRWM structure ending in final-look reveal, trending audio, diverse real customers `[S]` ([Brandwatch GRWM](https://brandwatch.com/?p=183403), [Influencer Marketing Hub](https://influencermarketinghub.com/tiktok-shop-campaigns-jewelry), [Tolstoy](https://www.gotolstoy.com/gallery/jewelry-styling-close-up-ugc-video)) | Hook on hands/ear · put-on · adjust · mirror check · final look · CTA |
| `stop_motion_reveal` | 5–30 s loops, phone on fixed mount, constant light, a few mm of movement per frame (box sliding, lid lifting, pieces arranging) `[S]` ([Kivo](https://kivopost.com/glossary/content-types-creative-formats-styles/stop-motion-video)) | Box slides in · lid lifts · tissue peels · piece rises · logo frame |
| `turntable_360` | Macro lens, turntable, static background and lighting, slow constant rotation, sometimes hanging rig for pendants; 6–10 s per revolution `[S]` ([Picup Media](https://blog.picupmedia.com/how-to-take-a-360-jewelry-video/), [Ortery](https://ortery.com/?p=123)) | Full 360 · half-turn hero · top-down spin |
| `unboxing` | First-person overhead or 45°, layered packaging (tissue, ribbon in one pull), ASMR sound, 9:16 4K, macro + tripod, diffused key plus small accent beam for sparkle, blur labels `[S]` (Grown Brilliance) | Box exterior · ribbon pull · lid lift · tissue · piece reveal · lift-to-camera · wear |

**Seasonal conventions** (enum `occasion`) `[C]` with timing from [Brandignity](https://www.brandignity.com/es/2026/01/jewelry-promotion-ideas-valentines-mothers-day-holiday-peaks/) and [DHL calendar](https://www.dhl.com/discover/en-global/e-commerce-advice/e-commerce-trends/e-commerce-marketing-calendar) `[S]`:

| Occasion | Launch lead | Palette / props | Hero products |
|---|---|---|---|
| `valentines` (Feb 14) | 3–6 weeks; demand concentrated in final 2 weeks | Red, blush, burgundy; roses, ribbon, heart motifs, candlelight, couple hands | Heart pendants, tennis bracelets, solitaire studs, promise rings |
| `mothers_day` (varies by market: UK Mar, US/EU May) | 3–6 weeks (6–10 made-to-order) | Soft pastels, florals, morning window light, multi-generational hands | Birthstone pieces, nameplates, charm bracelets, pearls |
| `holiday` (Nov–Dec, BFCM) | 6–10 weeks | Deep green/burgundy/gold, bokeh lights, velvet, snow, gift boxes | Gift sets, diamonds, statement earrings |
| `eid` (al-Fitr late Mar/Apr; al-Adha ~June; dates by moon sighting) | 4–6 weeks | Gold, emerald green, ivory, crescent/lantern/geometric motifs, modest wardrobe, henna hands | Gold sets, bangles, layered necklaces, children's gold |
| `bridal_wedding` (year-round; engagement season Dec–Feb) | ongoing | White/ivory, lace, flowers, soft diffused daylight, two hands | Engagement rings, bands, bridal earrings, tennis bracelets |
| `graduation`, `anniversary`, `birthday`, `new_year`, `diwali`, `lunar_new_year`, `black_friday` (optional) | | | |

---

## 3. Lighting craft

### 3.1 How professionals light jewelry `[S]`

- **Jewelry is a mirror.** Everything in the studio is part of the lighting design; polished metal shows a reflection of the room, bending along the curve of the band. Control what is reflected, not just the light ([Don Giannatti](https://dongiannatti.substack.com/p/twenty-assignments-to-build-your-a4a), [Nightjar](https://nightjar.so/blog/jewelry-photography-with-ai-capturing-sparkle-metal-and-detail)).
- **Large diffused sources** (softbox, scrim, light tent, light through acrylic) give smooth tonal gradients across metal and show metalwork ([GIA gem photography](https://www.gia.edu/gem-photography), [Visual Education](https://visualeducation.com/class/jewellery-photography-diamond-necklace/comment-page-1/)).
- **Gradient / black-card reflections**: black cards (flags) placed to reflect in polished surfaces add contrast and edge definition to metal; black cards inside a diffusion tent also increase internal contrast in facets ([Alan Ranger](https://www.alanranger.com/blog-on-photography/how-to-photograph-jewelry), [Clipping Expert](https://clippingexpertasia09.wordpress.com/2026/06/17/jewelry-photography-guide-how-to-capture-gemstone-sparkle/)). White cards fill shadows without creating a second hot spot.
- **Diamond sparkle** comes from small, hard, directional point sources (LED pin lights, snoots, fiber-optic heads) balanced with soft fill; a light tent alone makes diamonds look flat ([Photigy](https://www.photigy.com/school/forums/topic/techniques-for-lighting-to-catch-diamond-sparkles-in-product-videos/), [SkyJems](https://skyjems.ca/pages/encyclopedia-photo-cube)). Fiber-optic illumination is a point-source method that gives much stronger contrast than diffuse light and can be aimed freely around the gem ([gems-inclusions.com](https://www.gems-inclusions.com/inclusions-studies/photomicrography/), [Lotus Gemology](https://www.lotusgemology.com/resources/articles/134-fiber-optic-light-in-gemology-living-in-the-dark-ages-lotus-gemology)).
- **Edge/rim light**: narrow beam behind or above, slightly off-axis, to catch gem edges and metal rims.
- **Backlit colored gems** (transmitted light) make transparent stones glow but pavilion facets reflect light back, so pure backlighting often fails on faceted stones; a workaround is a point source behind the stone masked with black paper with a small hole; backlight also reveals polishing scratches ([Photo.net](https://www.photo.net/forums/topic/407234-lighting-gem-stones/), Lotus Gemology). Rule of thumb from vendors: crisp light for diamonds, soft light for pearls and opals, lower-key light for emeralds and sapphires ([Photta](https://www.photta.app/blog/ai-jewelry-try-on-models-without-photoshoot)).
- **Pearls**: few light sources (multiple reflections distort the apparent shape); a single strobe with reflector/grid is a classic setup; too much light washes out luster and overtones, too much contrast looks metallic, too little looks like plastic; harsher side light brings out orient/luster while a big soft source flattens it ([Jewellery Focus](https://www.jewelleryfocus.co.uk/?p=23349), [Pearl-Guide](https://www.pearl-guide.com/threads/andrews-photography-pearls.12397/post-12397), [Picup Media](https://picupmedia.com/?p=6612)).
- **White metals / color cast**: set a manual custom white balance from a white target at the subject position; block all mixed light (window + strobe); keep surroundings neutral (a yellow wall tints the diamond); use grey rather than pure white tent interiors for rhodium/platinum; even then silver can keep a yellow tinge and needs post correction ([Pricescope](https://www.pricescope.com/community/threads/photographing-diamond-jewelry.214223), [Ganoksin](https://orchid.ganoksin.com/t/experience-with-the-ezcube/31465)). Keep 5200–5600 K consistent across a set ([Alan Ranger](https://www.alanranger.com/blog-on-photography/how-to-photograph-jewelry)).
- **Polarizers / cross-polarization** reduce glare on enamel, glass and metal but should not be overdone; a little reflection keeps the piece alive.
- **Camera**: 85–105 mm macro, f/8–f/11 general, f/11–f/16 for max sharpness, tripod, ISO 100–200; focus stacking (8–15 frames for a ring, 20–40 for a flat necklace, 0.1–2 mm steps) when full sharpness is required; f/2.8–f/4 for intentional shallow-DOF mood ([Packshot Creator](https://www.packshot-creator.com/how-to/focus-stacking-jewelry/), [Orbitvu](https://orbitvu.com/blog/how-photograph-jewelry-10-tips-make-your-pictures-pro), [B&H](https://www.bhphotovideo.com/explora/node/97211)).

### 3.2 Controllable lighting vocabulary (enums for the prompt generator)

```
light_setup:      one_light | key_fill | key_fill_rim | tent_wrap | gradient_panel | sparkle_accent | backlit_glow | window | practical
key_quality:      soft_large (softbox/scrim/tent) | medium (umbrella/bounce) | hard_point (snoot/LED pin/fiber-optic) | mixed_soft_plus_point
key_direction:    top | top_front | top_back (rim) | side_left | side_right | front | under (transmitted) | 45_high_left | 45_high_right
fill:             none | white_card | silver_card | second_soft | ambient
negative_fill:    none | black_card_left | black_card_right | black_card_top | black_gradient_reflection
rim:              none | edge_light | hair_light | double_rim
sparkle:          none | low | medium | high  (maps to number/strength of point sources; 'high' = multiple pin lights, risk of flicker in video)
reflection_style: clean_gradient | environment_reflection | mirror_black | studio_white_wrap
color_temp_k:     3200 (tungsten/candle) | 4000 | 5000 | 5500 (daylight/studio) | 6500 (overcast) | mixed_warm_cool (editorial only)
white_balance:    neutral_locked | warm_bias | cool_bias   (default neutral_locked for white metals and diamonds)
mood:             high_key | low_key | studio_clean | window_daylight | golden_hour | blue_hour | overcast | candlelight | neon | moody_spotlight | dappled_shadow (botanical/slatted)
background:       seamless_white | seamless_grey | seamless_black | black_velvet | marble_white | marble_black | travertine | slate | sandstone | concrete | silk | satin | linen | velvet_colored | water_surface | wet_stone | sand | glass | mirror | acrylic_gradient | gradient_paper | foliage | fabric_drape | wood_light | wood_dark
surface_finish:   matte | satin | glossy | textured
```

Defaults per stone/metal, encodable as rules:
- `diamond/moissanite` → key soft + `sparkle:medium|high`, black negative fill, `white_balance:neutral_locked`.
- `step_cut` stones → larger soft sources, fewer point lights (big flashes, not pin sparkle).
- `colored transparent` (sapphire, emerald, aqua) → soft key + optional `backlit_glow`, slightly lower key level, saturated background complement.
- `opaque/cabochon/pearl` → single soft source, `sparkle:none|low`, side light for luster, no pin lights.
- `yellow/rose gold` → warm environment reflections allowed; `white_gold/platinum/silver` → neutral-grey environment, no warm casts.
- `enamel` → polarized/diffused, no hard specular.
- `high_polish` → gradient reflection required (define what the metal reflects); `brushed/matte` → tolerates harder light.

Mood presets (name → vocabulary) as a starting library: `studio_packshot` (tent_wrap, 5500 K, seamless_white, sparkle low–medium), `black_velvet_luxury` (key_fill_rim, hard_point sparkle high, 5000 K, black_velvet), `marble_morning` (window, 5500 K, marble_white, soft shadows), `golden_hour_skin` (practical sun, 3800–4500 K, warm bias on skin but neutral metal), `candlelit_gift` (3200 K, low_key, bokeh), `neon_edit` (mixed_warm_cool, colored rims; flag: destroys metal color accuracy, use only for editorial), `water_reflection` (top_back rim on water_surface), `botanical_shadows` (hard key through leaves).

---

## 4. Prompt engineering for jewelry fidelity in AI generation

### 4.1 Known failure modes (enum `qa_failure`) — all reported by practitioners/vendors `[S]`

| Failure | Description / evidence |
|---|---|
| `prong_count_drift` | 4-prong solitaire becomes chunky 6-prong; prongs migrate around the stone ([Blend](https://www.blendnow.com/blog/how-to-create-ai-photoshoot-for-jewelry-brand), [Kive](https://kive.ai/learn/ai-jewelry-product-photography)) |
| `setting_redesign` | Brushed-gold baguette ring returned as plain band, channel-set, stacked bands, or unrecognizable across tools ([FormaNova test](https://formanova.ai/blog/2026-06-03-best-ai-jewelry-photography-tools/), [Melius](https://www.melius.com/blog/best-ai-tools-jewelry-product-photos)) `[?]` vendor self-test |
| `extra_or_missing_stones` | Hallucinated pavé, lost accent stones, "odd miniature rings on baguettes", floating bezels ([GIA G&G Fall 2024](https://gia.edu/gems-gemology/fall-2024-artificial-intelligence-in-jewelry-design)) |
| `stone_shape_or_color_change` | Cut, color or size no longer matches the SKU, especially in video ([Cliprise](https://www.cliprise.app/learn/workflows/ecommerce/ai-jewelry-product-video-generator-workflow)) |
| `metal_color_shift` | Gold reads as brass or "painted plastic"; white gold vs silver indistinguishable; color drift between shots ([Nightjar](https://nightjar.so/help-desk/how-do-i-make-jewelry-or-metal-products-look-realistic-in-ai-images), [Astria](https://www.astria.ai/articles/ai-jewelry-photography/)) |
| `flat_highlights` | Highlights painted as shapes on the metal instead of environment reflections ([Nightjar](https://nightjar.so/blog/jewelry-photography-with-ai-capturing-sparkle-metal-and-detail)) |
| `dead_stones` | No refraction/fire; plastic sheen ([Astria](https://www.astria.ai/articles/ai-jewelry-photography/)) |
| `chain_warp_merge` | Links added/dropped between generations, chain geometry "melts" between frames, merged links (Kive, Cliprise) |
| `clasp_mechanism_wrong` | Toggle becomes ornament that does not close; clasps/earwires misunderstood ([Pietra](https://help.pietrastudio.com/en/articles/11510967-beginner-guide-creating-ai-content-for-jewelry-accessories-intricate-products)) |
| `contact_point_float` | Jewelry hovering off skin, ring not touching finger, necklace not following collarbone ([Invideo FAQ](https://invideo.io/faq/how-do-you-fix-ai-generated-jewelry-that-looks-fake-or/)) |
| `wrong_finger_or_placement` | Ring on wrong finger/hand, earring not through lobe, pendant off-center `[C]` |
| `scale_error` | Piece too large/small vs hand, ear, neck; floating packshots give no cue ([Astria](https://www.astria.ai/articles/ai-jewelry-photography/)) |
| `micro_detail_blur` | Micro-pavé, engraving, milgrain blur; source image <2000 px short side ([Blend](https://www.blendnow.com/blog/how-to-create-ai-photoshoot-for-jewelry-brand)) |
| `hallmark_text_artifact` | Invented hallmarks/engraving/logos; must match the real piece or be out of frame ([Scalio](https://scalio.app/blog/AI-Product-Photography-for-Jewelry-Complete-Guide-with-Examples/)) |
| `hand_anatomy` | Finger merging, extra fingers, implausible bending; worst when hands interact with objects ([AAAI HandRefiner](https://ojs.aaai.org/index.php/AAAI/article/view/37849/41811), [ZSky](https://zsky.ai/blog/how-to-fix-ai-hands.html)) |
| `shadow_light_mismatch` | Inconsistent shadow direction between product and scene; extreme relighting looks artificial ([Chase Jarvis](https://chasejarvis.com/blog/nano-banana-prompts/), Photta) |
| `join_breakdown` | Reconstructed pieces fall apart at joins: clasps, inner band, stone-to-setting (Kive) |
| `video_flicker_morph` | Sparkle flicker, morphing stones, objects passing through each other, drift after ~6 s in longer clips ([Artlist](https://artlist.io/blog/?p=65532), [NoteGPT](https://notegpt.io/blog/seedance-2-0-vs-kling-3-0)) |

### 4.2 Techniques that help `[S]` unless marked

1. **Reference-image conditioning is the primary lever.** Nano Banana Pro (Gemini 3) adheres to references far better than earlier tools ([Chase Jarvis / Weavy](https://chasejarvis.com/blog/create-a-virtual-product-shoot-in-weavy-nano-banana-fashion-editorial/)); it accepts up to 14 reference images and Higgsfield's guidance is to describe the role of each reference in the prompt ([Higgsfield help](https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-nano-banana)). Seedream 4/4.5 accepts 6–14 references depending on host and anchors identity to the first image; recommended set: 2–3 product angles, a macro/logo close-up, 1–2 lifestyle refs for color ([Segmind](https://blog.segmind.com/seedream-e-commerce-video-guide/), [Freepik](https://www.freepik.com/blog/introducing-seedream-4-5)) `[?]` counts vary by host.
2. **Supply multiple angles of the real piece** (front, ¾, profile, macro) and, for on-body shots, a photo of the piece worn; more angles mean fewer geometry surprises during turns ([Floyo Seedance workflow](https://www.floyo.ai/workflows/jewelry-animator-and-sparkle-with-se-401mmm578xtk), Invideo).
3. **Clean, high-res source**: ≥2000 px short side, piece filling 60–80% of frame, plain background, clear contours; a few hundred pixels of jewelry data is not enough ([Jewels Retouch](https://jewelsretouch.com/blog/how-to-prepare-jewelry-photos-for-ai-retouching), Pietra).
4. **Describe the exact piece before the scene**: metal, karat, finish, stone type/shape/carat, setting + prong count, chain type/length, clasp — before background or mood ([Dreamina](https://dreamina.capcut.com/ai-image/photorealistic-ai-generator-for-jewelry-ads)).
5. **Fidelity instruction**: state that the product must match the reference exactly, naming the invariants ("same 4 prongs, same oval stone, same chain link count, no added stones, no text/logo"); for shoes, explicit placement constraints prevent logo drift and the same pattern transfers (Segmind).
6. **Match lighting between source and scene**; if the packshot is bright daylight, generate a bright daylight scene (Pietra). For Nano Banana, use "thinking" mode and a physics-check instruction when shadows fall in impossible directions (Chase Jarvis).
7. **Change one variable at a time**: if something is off, change the prompt or the reference, not both (Higgsfield help).
8. **Edit/compose rather than regenerate**: generate the model/scene first, then use an edit model (Nano Banana, Seedream edit) to place the real product; backgrounds that already imply placement (finger angled for a ring, neckline for a necklace) land cleaner ([Floyo compositor](https://floyo.ai/workflows/jewelry-scene-compositor-with-nano-b-f9sc97jf0kpd)); Midjourney-style text-to-image is a poor fit for precise placement ([Reddit snapshot](https://reddit.sentinel-team.org/posts/1s4bwsw/snapshots/2026-03-27T19%3A35%3A05.89155Z)). Tool modes: "precise" (position/angle fixed, catalog) vs "creative" (perspective and light may change) (Pietra).
9. **Camera/lens language**: "100 mm macro, f/8–f/11, tripod, focus stacked, 5500 K, seamless white" and "50 mm / 85 mm portrait, f/2.8" for beauty crops; optical cues shape clarity and depth (Segmind prompt guide).
10. **Resolution / aspect**: generate at native 2K+ for macro and refinements (Segmind); generate at the delivery aspect (4:5, 9:16, 1:1) rather than cropping tight crops later; upscale as a final step and re-check facets after upscaling (vendor consensus).
11. **Simple hand poses**: hands clasped, resting on a table, in pockets, holding a simple prop are rendered more reliably than complex object interaction; fix hands by masked inpainting (2–3 attempts typical), MeshGraphormer/HandRefiner-style hand-aware inpainting in open pipelines ([RunComfy](https://www.runcomfy.com/comfyui-workflows/fix-hands-with-mesh-graphormer-controlnet-in-comfyui), [Hackernoon](https://hackernoon.com/how-to-fix-warped-hands-and-faces-in-ai-generated-video)).
12. **Negative prompts** (for models that accept them): "extra stones, extra prongs, duplicated chain, merged links, text, logo, watermark, hallmark, plastic sheen, blurry facets, extra fingers, fused fingers, floating jewelry" `[C]`.
13. **Keep AI output off primary PDP images where accuracy is legally material**; use it for lifestyle/campaign, keep a real macro as the product-of-record ([Astria](https://www.astria.ai/articles/ai-jewelry-photography/), Scalio).

### 4.3 QA checklist (encode as automated + human review) `[S]`

- Review at 100% (some say 200%) zoom at: outer silhouette, chain links, prongs, clasp opening, inner band, stone-to-setting joins, every stone edge ([Lamina](https://uselamina.ai/blog/ai-product-photography-for-jewelry-brands), Kive, Scalio).
- Compare against approved source: reject if prong count, setting geometry, stone color/shape, metal tone, chain length, scale, or clasp differ (Scalio).
- Hallmarks, maker's marks, serials, engravings, personalized text: must match or be out of frame.
- Contact: product touches skin where it should; shadow direction consistent with scene.
- Placement: correct finger/hand/ear/neck position per spec.
- Count checks: number of stones, links (visible), earrings (pair), prongs.
- Metal color check vs. reference swatch (automatable: mean hue of masked metal region within tolerance).
- Hands: five fingers, plausible joints, no fusion.
- Video: per-frame prong count/stone shape stability, no sparkle strobing, chain geometry constant across frames (Cliprise).

### 4.4 Tool landscape (as found; all vendor-described) `[?]`

- **Higgsfield**: Marketing Studio product-shot presets (418 presets listed via the API this session; names are scene-driven such as "Ice Cube Hover", "Linen Lid Lift", "Golden Dew", "Crescent Shadow", "Botanical Shadows", "Checkerboard Mosaic"; none are jewelry-specific by name, so jewelry presets would be built on top), Nano Banana / Nano Banana Pro hosting with multi-reference, Soul / Soul ID for characters ([help center](https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-create-and-use-a-soul-id-character)).
- **Kling**: own jewelry-video page recommends a sharp macro on a clean background, a "clean turntable" prompt with background and lighting held still, slow rotation to animate sparkle ([Kling](https://kling.ai/topics/ai-jewelry-video)).
- **Seedance 2.0 vs Kling 3.0**: Seedance credited with reference-locked consistency and preserving lighting direction/spatial consistency in multi-shot tests; Kling 3.0 with holding subjects and scenes reliably and multi-shot spatial continuity ([Magic Hour](https://magichour.ai/blog/kling-30-vs-seedance-20), Artlist, NoteGPT). None of these tests were jewelry-specific.
- **Flair.ai** positioned for tabletop jewelry/cosmetics with realistic shadows; **Claid** for bulk catalog; **Photoroom** for mobile background removal/templates; **Pebblely** for quick scenes ([Kive comparison](https://kive.ai/learn/best-ai-tools-for-product-photography), [Filestage](https://filestage.io/blog/ai-product-photography/)). **Nightjar**, **Photta**, **Blend**, **FormaNova**, **Pietra**, **Kive** market jewelry-preserving pipelines. No independent benchmark on reflective metal was found.
- **Weavy + Nano Banana** virtual product shoot walkthrough ([Chase Jarvis](https://chasejarvis.com/blog/create-a-virtual-product-shoot-in-weavy-nano-banana-fashion-editorial/)).

### 4.5 Prompt template skeleton

```
[FORMAT] {format} for {channel}, {aspect}, {resolution}.
[PRODUCT — must match reference images exactly] {category}/{subtype}: {metal karat finish}; {stones: role/type/shape/carat/mm}; setting {setting} with exactly {prong_count} prongs; {chain type, length} with {clasp}; band {band_width_mm} mm. No added stones, no text, no logo, no hallmark.
[WEAR] on {hand}.{finger} | {ear side} | neck at {chain_length} in sitting at {landmark}. Product in full contact with skin; scale: {stone_mm} mm stone on ~{finger_width} mm finger.
[TALENT] {age_range}, Monk skin tone {1-10}, {hair}, nails {natural|clear|nude|…}, wardrobe {palette, neckline}, hair {tucked back|up}.
[CAMERA] {lens} mm, f/{aperture}, {angle}, {shot_size}, focus on product, {depth_of_field}.
[LIGHTING] {light_setup}, key {key_quality} from {key_direction}, fill {fill}, negative fill {negative_fill}, rim {rim}, sparkle {sparkle}, {color_temp_k} K, white balance neutral on metal, reflections {reflection_style}.
[SCENE] background {background} ({surface_finish}), mood {mood}, props {props}, negative space {copy_safe_area}.
[NEGATIVE] extra stones, extra prongs, duplicated/merged chain links, floating product, text, watermark, plastic sheen, blurry facets, extra or fused fingers.
```

---

## 5. Delivery specs (2026)

No official platform page could be fetched in this sandbox; figures below are consolidated from multiple 2026 third-party spec guides and conflict where noted. Treat as defaults that the app should expose as editable constants and re-verify against each platform's help center before launch.

| Channel | Aspect | Recommended pixels | Duration / size | Safe zones & notes | Source |
|---|---|---|---|---|---|
| Instagram feed (image) | 4:5 (preferred), 1:1, 1.91:1 | 1080×1350 / 1080×1080 / 1080×566 | image ≤30 MB (ads) | Reels shown in feed are cropped to 4:5 — keep subject in the center 4:5 of a 9:16 | [Kapwing](https://www.kapwing.com/resources/social-media-video-aspect-ratios-and-sizes-the-2025-guide/), [Firstpier](https://www.firstpier.com/resources/facebook-ad-sizes) |
| Instagram Reels | 9:16 | 1080×1920 (some guides say Meta now recommends 1440×2560 `[?]`) | organic up to 3 min widely; 20-min uploads reported for some accounts `[?]`; >3 min not recommended to non-followers; ads 1 s–15 min; ≤4 GB | Ads: keep text/logo out of top 14%, bottom 35%, sides 6% (common citation); some cite bottom 20% `[?]`; a "unified 9:16 safe zone" from March 2026 is claimed but unverified | [Hopper HQ](https://www.hopperhq.com/blog/instagram-reel-size/), [Billo](https://billo.app/?p=50654), [adkit](https://adkit.so/tools/safe-zones/instagram), [Kontentino](https://www.kontentino.com/q-and-a/how-long-can-instagram-reels-be/) |
| Instagram Stories | 9:16 | 1080×1920 | 15 s per card (video auto-splits); ads up to 60 s `[C]` | Same 14% / 35% guidance; profile UI top, reply bar bottom | Hopper HQ, adkit |
| TikTok (organic + In-Feed ads) | 9:16 | 1080×1920 | ads 5–60 s (sweet spot 21–34 s); organic record 10 min, upload up to 60 min `[?]`; file 500 MB (some cite 287.6 MB iOS / 72 MB Android) `[?]` | avoid top ~150 px, right ~120 px, bottom 350–400 px (reverse-engineered) | [JoinBrands](https://joinbrands.com/blog/tiktok-ad-specifications/), [TryMyPost](https://www.trymypost.com/blog/tiktok-ad-specs-2026-safe-zones), [Postfast](https://postfa.st/sizes/tiktok/video/2025) |
| YouTube Shorts | 9:16 (1:1 accepted) | 1080×1920 | ≤3 min (180 s) since Oct 2024 | keep text above bottom ~15% (title/engagement UI) and clear of right-side buttons | [Reap](https://reap.video/blog/best-video-length-youtube-shorts-reels-tiktok), [AdCreate](https://adcreate.com/blog/youtube-shorts-length-guide-2026) |
| Pinterest standard Pin | 2:3 | 1000×1500 | image <20 MB (some say 32 MB) `[?]` | wider than 2:3 gets cropped; squares get less space | [soona](https://soona.co/image-resizer/pinterest-image-size-specs), [Screensnap](https://www.screensnap.pro/blog/pinterest-pin-size-guide) |
| Pinterest video Pin | 9:16 or 2:3 (1:1, 4:5 accepted) | 1080×1920 / 1000×1500 | 4 s – 5 min (some guides say 15 min) `[?]`; ≤2 GB; MP4/MOV/M4V; 6–15 s recommended | title overlay area bottom | [Boomp](https://boomp.net/blog/pinterest-video-size-2026), [socialk.it](https://socialk.it/en/sizes/pinterest-video-pin-size) |
| Meta ads feed (FB/IG) | 4:5 or 1:1 | 1080×1350 / 1080×1080 (some cite 1440×1800) | video ≤4 GB; image ≤30 MB; ≥1080 px shortest side | carousel cards cropped to 1:1; 20% text rule no longer enforced but keep headlines short | [Firstpier](https://www.firstpier.com/resources/facebook-ad-image-size), [adsuploader](https://adsuploader.com/blog/meta-ads-aspect-ratios), [Ryze](https://www.get-ryze.ai/de/blog/facebook-ad-sizes-complete-specs-guide-for-2026) |
| Meta Stories/Reels ads | 9:16 | 1080×1920 (or 1440×2560) | Reels ads 1 s–15 min; Stories up to 60 s `[C]` | 14% top / 35% bottom / 6% sides (≈358 / 896 / 86 px at 1440×2560) | Billo, [moda](https://moda.app/resources/sizes/meta-reels-ad) |
| Website hero | 16:9 desktop, separate mobile crop (≈1:1 or 4:5) | 1920×1080 baseline; 2560×1440 for high-density; Shopify full-bleed 2560×1400; mobile e.g. 800×800 | ≤300–500 KB after compression `[C]` | serve via srcset/picture; keep focal point centered; expect hard crops on full-height heroes | [Adobe community](https://experienceleaguecommunities.adobe.com/adobe-marketo-engage-27/landing-pages-banner-sizes-183823), [UWO](https://www.communications.uwo.ca/digital-resources/cascade-design-library/hero-banners.html), [moda Shopify](https://moda.app/resources/sizes/shopify-hero-image) |
| Email hero/header | ~3:1 to 2:1 | design at 1200 px wide, display at 600 px (2×); header height 150–250 px | <200 KB, ideally <100 KB | 600–640 px container is convention, not a standard; Outlook-heavy lists stay ≤640 | [Mailmodo](https://www.mailmodo.com/guides/email-image-size/), [Tabular](https://tabular.email/blog/email-template-size-width-and-height), [Zoho](https://www.zoho.com/zeptomail/articles/email-template-size.html) |
| Print lookbook (A4) | page ratio 1:1.414 | 300 dpi at final size: A4 full page ≥2480×3508 px; A4 spread ≈4961×3508 | PDF/X, CMYK, fonts embedded | 3 mm bleed all sides; ≥10 mm safe zone (perfect bound); page count divisible by 4; convert RGB→CMYK before export, expect metallic/gold gamut loss (soft-proof); US Letter 2550×3300 px `[C]` | [Paperlust](https://printshop.paperlust.co/blog?p=4094), [Tradeprint](https://www.tradeprint.co.uk/booklets-and-brochures/lookbooks), [Made Good Designs](https://madegooddesigns.com/lookbook-design/) |

Generation implications: generate masters at the largest needed aspect (e.g., 4:5 at ≥2160×2700 and 9:16 at ≥1440×2560), keep product inside the intersection of all safe zones (center ~70% vertically for 9:16), and produce print masters at 300 dpi via upscale with facet re-check.

---

## 6. Video campaign conventions for jewelry

### 6.1 Structures (6–30 s) `[S]` + `[C]`

General ad anatomy: hook (0–3 s) → context → reveal/demo → proof → CTA; short cuts compress the middle beats ([Segwise](https://segwise.ai/blog/anatomy-top-performing-video-ad-frame-by-frame), [Sovran](https://sovran.ai/blog/hook-body-cta-video-ad-structure)). Jewelry-specific:

| Template (enum `video_structure`) | Beats |
|---|---|
| `reveal_6s` | 0–1.5 s macro sparkle hook (partial piece) → 1.5–4.5 s slow pull-out/orbit reveal → 4.5–6 s logo end card |
| `detail_10s` | hook macro → orbit → rack focus to second detail → worn cutaway → end card |
| `lifestyle_15s` | hook (hand/ear gesture) → put-on moment → lifestyle medium → macro proof → CTA/logo |
| `ugc_20s` | creator hook → unbox/put-on → mirror/try-on → close-up proof → verbal CTA |
| `gifting_30s` | setup (couple/occasion) → box reveal → placing on body → reaction → product beauty → end card with offer |
| `turntable_loop` | seamless 6–10 s rotation, no cuts (PDP / Pinterest) |

Keep one motion idea per beat; test variants that change only the hook ([Oakgen](https://oakgen.ai/blog/first-frame-hooks-product-video-ads), [Vidmuse](https://vidmuse.ai/blog/product-reveal-video)). Luxury reads as slow: gentle glides and soft rotations, avoid fast spins/zooms; clips of ~6–10 s per shot ([Weshop](https://www.weshop.ai/blog/?p=8371)).

### 6.2 Camera moves that flatter jewelry (enum `camera_move`)

`static | slow_orbit_cw | slow_orbit_ccw | macro_push_in | pull_out_reveal | rack_focus_stone_to_face | rack_focus_face_to_stone | light_sweep (fixed camera, light source moves across facets) | tilt_up_reveal | top_down_spin | hand_gesture_reveal (hand rotates/opens to show ring) | hair_tuck_reveal (earrings) | collar_adjust_reveal (necklace) | dolly_along_chain | parallax_slide | turntable_360`

Rationale: orbit shows shape/materials/key angles; push-in works as a hook; a small pan across detail guides the eye ([Vidmuse prompts](https://vidmuse.ai/blog/product-video-ad-prompts)); rotation is what animates sparkle (Kling).

### 6.3 What AI video does well/badly with jewelry `[S]` `[?]`

- Well: slow rotations on a static background from a sharp macro still; subtle reflections and sparkle transitions; short clips (≤6–10 s) (Kling, Weshop).
- Badly: prong count changing mid-clip, chain geometry melting between frames, stone cut/color/size drifting, sparkle flicker/strobing from inconsistent specular rendering, morphing or objects passing through each other in longer clips, face/hand drift around second 6 (Cliprise, Artlist, NoteGPT). Vendor workflows add a separate sparkle-enhancement pass on stills before animating, implying models do not generate convincing sparkle unaided ([Floyo](https://www.floyo.ai/workflows/jewelry-animator-and-sparkle-with-se-401mmm578xtk)).
- Mitigations: start from an approved still (image-to-video), one buyer question per clip, hold background and lighting static, limit camera to one move, keep clips short and cut rather than generate long takes, reference-lock with multiple angles (Seedance), re-check prong/stone per frame.

### 6.4 Storyboard fields a generator should output per shot

```json
{
  "shot_id": "S03",
  "duration_s": 2.5,
  "shot_size": "ECU | CU | MCU | MS | MLS | WS",
  "angle": "eye_level | high | low | top_down | 45_three_quarter",
  "camera_move": "slow_orbit_cw",
  "move_speed": "slow | medium",
  "lens_mm": 100,
  "aperture": "f/8",
  "focus": "product | face | rack:product->face",
  "lighting": {"setup": "key_fill_rim", "key": "soft_large/top_front", "sparkle": "medium", "color_temp_k": 5500, "mood": "studio_clean"},
  "background": "black_velvet",
  "subject_action": "hand rotates slowly, fingers relaxed",
  "product_placement": {"category": "ring", "finger": "left.ring", "visibility": "full | partial | reveal"},
  "product_invariants": ["4 prongs", "oval stone", "no added stones"],
  "talent_ref": "char_01",
  "transition_in": "cut | dissolve | match_cut | whip | light_flare",
  "transition_out": "cut",
  "audio_cue": "sparkle chime | ASMR box open | music beat hit | VO line | silence",
  "text_overlay": {"copy": "", "safe_zone": "center"},
  "model": "kling3 | seedance2 | soul",
  "source_still": "S03_keyframe.png",
  "qa_flags": ["prong_count", "sparkle_flicker", "chain_geometry"]
}
```

---

## 7. People / model casting and consistent characters

### 7.1 How brands specify talent `[S]` + `[C]`

| Field | Values / notes |
|---|---|
| `age_range` | e.g. 18–24, 25–34, 35–44, 45–60, 60+ (bridal skews 25–35; Mother's Day multi-generational) `[C]` |
| `skin_tone` | **Monk Skin Tone scale 1–10** (CC BY 4.0, designed to replace Fitzpatrick in tech contexts and better represent darker skin) `[S]` ([Reuters via FT.lk](https://www.ft.lk/it-telecom-tech/Google-unveils-new-10-shade-skin-tone-scale-to-test-AI-for-bias/50-734704), [Cosmetics & Toiletries](https://www.cosmeticsandtoiletries.com/formulas-products/color-cosmetics/news/22946695/the-key-to-better-ai-predictions-and-makeup-matches)); keep Fitzpatrick I–VI as a legacy alias. Also capture `undertone: warm | cool | neutral | olive` because it drives metal pairing: warm → yellow/rose gold, cool → silver/white gold/platinum (rose gold also works), neutral → either `[S]` ([Swarovski](https://www.swarovski.com/en_GB-CA/s-how-to-style-color/), [Robinsons](https://robinsonsjewelers.com/blogs/news/how-do-you-tell-if-your-skin-looks-better-with-gold-or-silver)) |
| `hair` | length (`cropped | short | bob | shoulder | long`), texture, color; `hair_state: tucked_behind_ear | up | pulled_back | down` — earrings require ear visibility ([Photta](https://www.photta.app/tools/on-model-jewelry-photography), [Techpresso prompts](https://academy.techpresso.co/prompts/chatgpt-prompts-jewelry-photography)) |
| `hands` | smooth even skin, long slender fingers, well-shaped natural nails; manicure `natural | clear | nude | soft_pink | french | short_neutral` (keep quiet so jewelry is the focus); no visible veins/redness; graceful controlled movement `[S]` ([Freelancer brief](https://www.freelancer.de/projects/photography/female-hand-model-for-jewelry), [Wima Models](https://wimamodels.de/en/body/hands)) |
| `ears` | lobe visible, no competing piercings unless stacking is the concept, hair clear `[C]` |
| `neckline` | `v_neck → drop/pendant mirroring the V; crew → short pendant or layering; high/turtleneck → long chain below collarbone; strapless/off_shoulder → short/choker; sweetheart/scoop → delicate; halter → skip necklace, use earrings` `[S]` ([Gabriel NY](https://www.gabrielny.com/blog/what-necklace-to-wear-with-every-neckline/), [Dana Rebecca](https://www.danarebeccadesigns.com/blogs/drd-blog/what-necklace-to-wear-with-what-neckline), [Jewelers Mutual](https://www.jewelersmutual.com/resources/individuals/necklaces/what-necklace-wear-different-necklines)) |
| `wardrobe_palette` | cool blues/greens with silver/white gold; warm earth tones and reds with yellow gold; black/white/neutrals with either `[S]` ([Mia by Tanishq](https://www.miabytanishq.com/en/blogs/beginners-guide/necklace-designs-for-different-necklines)); matte fabrics (silk-matte, knit, linen) to avoid competing specular; no logos/prints near product `[C]` |
| `makeup` | minimal on hand/ear shots; neutral lip for neck crops `[C]` |
| `body_crop_needed` | `ear | neck | decolletage | hand | wrist | face_34 | half_body | full_body` |
| `expression / gesture` | calm, hands relaxed, "touching collarbone", "tucking hair", "adjusting cuff" `[C]` |
| `consent / likeness` | real-person likeness requires permission (Higgsfield Soul ID policy) `[S]` |

### 7.2 Consistent-character workflows `[S]`

- **Higgsfield Soul ID** (real people): Soul → Train new character → upload 20–80 sharp, well-lit photos with varied angles/expressions, at least one full-height, recent (4–5 months), no sunglasses/heavy shadows/cropped faces, no repeated pose → train (minutes) → select character when generating. Invented characters use AI Influencer Studio / Soul Cast instead ([help center](https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-create-and-use-a-soul-id-character)). Cross-model video reuse goes through supported "Elements" routes; do not assume a facial lock on every video model `[?]` ([frankx](https://www.frankx.ai/guides/higgsfield-soul-id-character-consistency)).
- **Character sheet method** (invented talent): generate a multi-angle sheet — front, three-quarter, side profile, optional full body — via grid generation or 3D orbit of one generation, composite the best angles into one sheet, use as the identity reference ([Soul skill listing](https://openskillindex.com/skills/osidemedia-higgsfield-ai-prompt-skill-higgsfield-soul)).
- **Reference pack with review checks**: neutral portrait, ¾ view, profile, full body, outfit details, expression sheet, location reference; each with a check (hairstyle match, jaw/nose consistency); store under durable IDs; decide explicitly which features must stay recognizable (frankx).
- **Outfit/identity locking across shots**: feed the character sheet plus outfit reference plus product references in every generation, naming each image's role; anchor identity to the first reference (Seedream behavior); keep lighting direction constant across shots; for video prefer models credited with reference-locked consistency (Seedance 2) or multi-shot continuity (Kling 3) and keep shots short (Magic Hour, NoteGPT).
- App fields: `character_id`, `sheet_images[front, three_quarter, profile, full_body]`, `outfit_refs[]`, `locked_features[]` (face, hair, skin tone, nails), `allowed_variation[]` (expression, pose), `consent_status`.

---

## 8. Open questions and uncertainties to resolve before shipping

1. Platform durations/safe zones conflict across 2026 guides (Reels 3 vs 20 min; TikTok 10 vs 60 min; Pinterest video 5 vs 15 min; Meta "unified safe zone"). Store as editable constants and verify on each help center.
2. Ear cuff, climber, cufflink, brooch, pendant and body-jewelry dimensions are mostly `[C]`; no authoritative charts were found this session.
3. Hoop and stud size-class boundaries vary by retailer by ±5 mm; pick one scheme and label it.
4. No independent benchmark exists for reflective-metal fidelity across Nano Banana Pro, Seedream, Kling 3, Seedance 2; all claims are vendor-run. Build an internal "hard pieces" test set (brushed gold + baguettes, micro-pavé, toggle clasp, fine cable chain, pearl strand) and score each model with the QA checklist.
5. Sparkle flicker in AI video is reported anecdotally; no quantitative data. Treat `sparkle:high` as risky for video and expose a flicker check.
6. Higgsfield Marketing Studio has no jewelry-named product-shot presets; jewelry presets must be authored (scene + lighting vocab above) rather than mapped to existing ones.
7. Print CMYK: metallic gold/rose gold and saturated gem colors fall outside CMYK gamut; soft-proofing guidance was not found this session (`[C]`).

---

## 9. Source index (all links cited inline above)

Taxonomy & sizing: Brilliant Earth (necklace length, ring width, tennis bracelet), Bluestone, Jewelove, Virage London, Baby Gold, Blue Nile, Frank Jewelers, The Jewellery Room, Clean Origin, Theo Grace, Kay, Tiffany, Perfect Corp, Love & Co, Liori, Washington Diamond, Robinsons (signet), AJ Luxe, Zales, Juwelenn, StoneAlgo, Stuller, GIA 4Cs, Leibish, Whiteflash, Maison Miru, Etsy climber listing, Gabriel NY, Borsheims, Azeera.
Formats: Branvas, Squareshot, Photta, Format, Cristy Cross, Robinsons (Instagram), Grown Brilliance, National Jeweler, Kivo, Picup Media, Ortery, Tolstoy, Brandwatch, Influencer Marketing Hub, Prohibition PR, JCK, Brandignity, DHL, PetaPixel, DIY Photography, Packshot Creator, Broncolor.
Lighting: Don Giannatti, Alan Ranger, GIA gem photography, Visual Education, Photigy, SkyJems, gems-inclusions.com, Lotus Gemology, Photo.net, Jewellery Focus, Pearl-Guide, Picup Media, Pricescope, Ganoksin, Orbitvu, B&H, Photofocus, Clipping Expert Asia.
AI generation: Astria, Pietra, Dreamina, Invideo, Claid, Blend, Melius, Kive, Nightjar, FormaNova, Scalio, Lamina, Jewels Retouch, GIA G&G (Fall 2024), Chase Jarvis, Picsart, Higgsfield help center & blog, Floyo, Segmind, Freepik, Artlist, Magic Hour, NoteGPT, Kling, Cliprise, Weshop, RunComfy, Hackernoon, AAAI, ZSky, Reddit snapshot.
Delivery: Kapwing, Quso, Hopper HQ, Billo, adkit, moda, Firstpier, adsuploader, Ryze, JoinBrands, TryMyPost, Postfast, Reap, AdCreate, Kontentino, soona, Boomp, socialk.it, Screensnap, Mailmodo, Tabular, Zoho, Adobe community, UWO, Paperlust, Tradeprint, Made Good Designs.
Casting: Reuters (via FT.lk / BusinessWorld), Cosmetics & Toiletries, Imatest, Swarovski, Robinsons, Antique Jewellery Company, Gabriel NY, Dana Rebecca, Jewelers Mutual, Mia by Tanishq, Freelancer brief, Wima Models, soona, Lemon8, frankx, OpenSkillIndex, Higgsfield help center.
