### `alibaba/happy-horse/image-to-video`  — Happy Horse 1.0 (image2video)
- summary: Happy Horse 1.0 - Image to Video. Configured Alibaba route; cloned from hh/image-to-video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.490
- required: image_url
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..15] default=5
  - `image_url`: string (URL)
  - `resolution`: string 720p|1080p default=720p


### `alibaba/happy-horse/reference-to-video`  — Happy Horse 1.0 (image2video)
- summary: Happy Horse 1.0 - Reference to Video. Configured Alibaba route; cloned from happy-horse/reference-to-video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.490
- required: image_urls, prompt
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..15] default=5
  - `image_urls`: array
  - `resolution`: string 720p|1080p default=720p


### `alibaba/happy-horse/text-to-video`  — Happy Horse 1.0 (image2video)
- summary: Generates videos from text or image references with clips up to 15 seconds and 1080p resolution.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.490
- required: prompt
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `resolution`: string 720p|1080p default=720p
  - `aspect_ratio`: string 16:9|9:16|1:1|4:3|3:4 default=16:9


### `alibaba/happy-horse/v1.1/image-to-video`  — HappyHorse 1.1 (image2video)
- summary: HappyHorse 1.1 - Image to Video. Configured Alibaba route; cloned from hh/image-to-video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.630
- required: image_url
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..15] default=5
  - `image_url`: string (URL)
  - `resolution`: string 720p|1080p default=1080p


### `alibaba/happy-horse/v1.1/reference-to-video`  — HappyHorse 1.1 (image2video)
- summary: HappyHorse 1.1 - Reference to Video. Configured Alibaba route; cloned from happy-horse/reference-to-video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.630
- required: image_urls, prompt
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..15] default=5
  - `image_urls`: array
  - `resolution`: string 720p|1080p default=1080p


### `alibaba/happy-horse/v1.1/text-to-video`  — HappyHorse 1.1 (image2video)
- summary: Generates videos from text or image references with output at 1080p and clips up to 15 seconds.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.630
- required: prompt
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `resolution`: string 720p|1080p default=1080p
  - `aspect_ratio`: string 16:9|9:16|1:1|4:3|3:4 default=16:9


### `alibaba/qwen-image-3/edit`  — Qwen Image 3 (image_edit)
- summary: Edit images from an instruction and one to three ordered references with Qwen Image 3.
- outputs: images | sample price (defaults, 2026-09-26): $0.040
- required: prompt, image_urls  (allOf: [{"if":{"required":["enable_thinking"],"properties":{"enable_thinking":{"const":true}}},"then":{"required":["prompt_extend"],"properties":{"prompt_extend":{"const":true}}}}])
- params:
  - `seed`: integer [0..2147483647] — Optional random seed for similar, reproducible results.
  - `prompt`: string — Positive prompt or editing instruction in Chinese or English. Alibaba recommends at most 4,500 tokens.
  - `image_urls`: array items[1..3] — One to three ordered public image URLs used as editing references.
  - `resolution`: string 1k|2k default=1k — Output resolution tier. Both tiers produce PNG images.
  - `aspect_ratio`: string 1:1|2:3|3:2|3:4|4:3|7:9|9:7|9:16|16:9|21:9 default=1:1 — Output aspect ratio. Exact provider-recommended dimensions are selected automatically.
  - `prompt_extend`: boolean default=true — Improve the prompt before generation. Required when thinking mode is enabled.
  - `enable_thinking`: boolean default=true — Use model reasoning to improve image quality. Requires prompt enhancement.
  - `negative_prompt`: string — Content, styles, or artifacts to avoid in the output.
  - `prompt_extend_mode`: string direct default=direct — Direct enhancement is available for every request; agent enhancement is text-to-image only.


### `alibaba/qwen-image-3/text-to-image`  — Qwen Image 3 (text2image)
- summary: Generates images from English or Chinese text, with enhanced prompts and resolution up to 2K.
- outputs: images | sample price (defaults, 2026-09-26): $0.040
- required: prompt  (allOf: [{"if":{"required":["enable_thinking"],"properties":{"enable_thinking":{"const":true}}},"then":{"required":["prompt_extend"],"properties":{"prompt_extend":{"const":true}}}}])
- params:
  - `seed`: integer [0..2147483647] — Optional random seed for similar, reproducible results.
  - `prompt`: string — Positive prompt or editing instruction in Chinese or English. Alibaba recommends at most 4,500 tokens.
  - `resolution`: string 1k|2k default=1k — Output resolution tier. Both tiers produce PNG images.
  - `aspect_ratio`: string 1:1|2:3|3:2|3:4|4:3|7:9|9:7|9:16|16:9|21:9 default=1:1 — Output aspect ratio. Exact provider-recommended dimensions are selected automatically.
  - `prompt_extend`: boolean default=true — Improve the prompt before generation. Required when thinking mode is enabled.
  - `enable_thinking`: boolean default=true — Use model reasoning to improve image quality. Requires prompt enhancement.
  - `negative_prompt`: string — Content, styles, or artifacts to avoid in the output.
  - `prompt_extend_mode`: string direct|agent default=direct — Direct enhancement is available for every request; agent enhancement is text-to-image only.


### `alibaba/wan-3.0/image-to-video`  — Wan 3.0 Image to Video (image2video)
- summary: Generate videos from a starting image with Wan 3.0.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (rule)
- pricing: Priced per generated second by resolution: 480p $0.05, 720p $0.10, or 1080p $0.20. Rates shown are before any applicable customer discount.
- required: prompt, image_url
- params:
  - `seed`: integer [0..2147483647]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..30] default=5 — 2-30 seconds.
  - `image_url`: string (URL)
  - `resolution`: string 480p|720p|1080p default=1080p
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|adaptive default=adaptive
  - `end_image_url`: string (URL)
  - `generate_audio`: boolean default=true
  - `enable_thinking`: boolean default=false


### `alibaba/wan-3.0-prime/image-to-video`  — Wan 3.0 Prime Image to Video (image2video)
- summary: Generate videos from a starting image with Wan 3.0 Prime.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.980
- required: prompt, image_url
- params:
  - `seed`: integer [0..2147483647]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..30] default=5 — 2-30 seconds.
  - `image_url`: string (URL)
  - `resolution`: string 480p|720p|1080p default=1080p
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|adaptive default=adaptive
  - `end_image_url`: string (URL)
  - `generate_audio`: boolean default=true
  - `enable_thinking`: boolean default=false


### `alibaba/wan-3.0-prime/reference-to-video`  — Wan 3.0 Prime Reference to Video (image2video)
- summary: Generate videos guided by reference images with Wan 3.0 Prime.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.980
- required: prompt
- params:
  - `seed`: integer [0..2147483647]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..30] default=5 — 2-30 seconds.
  - `file_url`: string (URL) — One document (docx/xlsx/pptx/pdf/md). Forces deep thinking.
  - `link_url`: string (URL) — One public page. Forces deep thinking. Not combinable with file_url.
  - `audio_urls`: array items[0..5] — Up to 5 files, 30s total. WAV or MP3.
  - `image_urls`: array items[0..10]
  - `resolution`: string 480p|720p|1080p default=1080p
  - `video_urls`: array items[0..5] — Up to 5 clips, 30s total, each 1-30s.
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|adaptive default=adaptive
  - `generate_audio`: boolean default=true
  - `enable_thinking`: boolean default=false


### `alibaba/wan-3.0-prime/text-to-video`  — Wan 3.0 Prime Text to Video (text2video)
- summary: Generates videos from text or media references with fast processing and clips up to 30 seconds.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.980
- required: prompt
- params:
  - `seed`: integer [0..2147483647]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..30] default=5 — 2-30 seconds.
  - `resolution`: string 480p|720p|1080p default=1080p
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|adaptive default=adaptive
  - `generate_audio`: boolean default=true
  - `enable_thinking`: boolean default=false


### `alibaba/wan-3.0/reference-to-video`  — Wan 3.0 Reference to Video (image2video)
- summary: Generate videos guided by reference images with Wan 3.0.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (rule)
- pricing: Priced per generated second by resolution: 480p $0.05, 720p $0.10, or 1080p $0.20. Rates shown are before any applicable customer discount.
- required: prompt
- params:
  - `seed`: integer [0..2147483647]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..30] default=5 — 2-30 seconds.
  - `file_url`: string (URL) — One document (docx/xlsx/pptx/pdf/md). Forces deep thinking.
  - `link_url`: string (URL) — One public page. Forces deep thinking. Not combinable with file_url.
  - `audio_urls`: array items[0..5] — Up to 5 files, 30s total. WAV or MP3.
  - `image_urls`: array items[0..10]
  - `resolution`: string 480p|720p|1080p default=1080p
  - `video_urls`: array items[0..5] — Up to 5 clips, 30s total, each 1-30s.
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|adaptive default=adaptive
  - `generate_audio`: boolean default=true
  - `enable_thinking`: boolean default=false


### `alibaba/wan-3.0/text-to-video`  — Wan 3.0 Text to Video (text2video)
- summary: Generates videos from text or images with native audio and adjustable duration up to 30 seconds.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (rule)
- pricing: Priced per generated second by resolution: 480p $0.05, 720p $0.10, or 1080p $0.20. Rates shown are before any applicable customer discount.
- required: prompt
- params:
  - `seed`: integer [0..2147483647]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..30] default=5 — 2-30 seconds.
  - `resolution`: string 480p|720p|1080p default=1080p
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|adaptive default=adaptive
  - `generate_audio`: boolean default=true
  - `enable_thinking`: boolean default=false


### `bytedance/seedance-2.0/image-to-video`  — Seedance 2.0 (image2video)
- summary: Generate videos from text with controls for duration, resolution, aspect ratio, and optional audio. Create polished multi-shot stories for ads, social content, and cinematic scenes
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Token-metered pricing. Billable video tokens = ceil(generated video seconds × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. Per 1,000 video tokens: 480p/720p/1080p $0.014, 4K $0.008. Rates shown are before any applicable customer discount.
- required: image_url
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [4..15] default=5
  - `image_url`: string (URL)
  - `resolution`: string 480p|720p|1080p|4k default=720p
  - `end_image_url`: string (URL)
  - `generate_audio`: boolean default=true


### `bytedance/seedance-2.0/reference-to-video`  — Seedance 2.0 (image2video, video2video)
- summary: Seedance 2.0 Reference to Video generates videos from images or existing videos, allowing customization of duration, resolution, aspect ratio, and audio inputs. It supports image-to-video and video-to-video transformations with optional audio generation.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Token-metered pricing. Billable video tokens = ceil((input video seconds + generated video seconds) × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. Per 1,000 video tokens: without video input — 480p/720p/1080p $0.014, 4K $0.008; with video input — 480p/720p/1080p $0.0084, 4K $0.0048 (0.6× the standard rate). With video references, both input and generated video durations are billable. Rates shown are before any applicable customer discount.
- required:   (conditional: {"if":{"required":["image_urls"]},"then":null,"else":{"required":["video_urls"]}})
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [4..15] default=5
  - `audio_urls`: array items[1..3]
  - `image_urls`: array items[1..9]
  - `resolution`: string 480p|720p|1080p|4k default=720p
  - `video_urls`: array items[1..3]
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|21:9 default=16:9
  - `generate_audio`: boolean default=true


### `bytedance/seedance-2.0/text-to-video`  — Seedance 2.0 (text2video)
- summary: Creates 4K video from text or media references. Supports up to 15 seconds with optional sound.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Token-metered pricing. Billable video tokens = ceil(generated video seconds × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. Per 1,000 video tokens: 480p/720p/1080p $0.014, 4K $0.008. Rates shown are before any applicable customer discount.
- required: prompt
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [4..15] default=5
  - `resolution`: string 480p|720p|1080p|4k default=720p
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|21:9 default=16:9
  - `generate_audio`: boolean default=true


### `bytedance/seedance-2.5/image-to-video`  — Seedance 2.5 (image2video)
- summary: Seedance 2.5 Image to Video generates videos from a single image URL with optional prompts, customizable duration, resolution, and output format. It supports adding an end image and generating audio to enhance the video output.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (rule)
- pricing: Token-metered pricing. Billable video tokens = ceil((input video seconds + generated video seconds) × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. At 480p or 720p, each 1,000 video tokens cost $0.0214. Rates shown are before any applicable customer discount.
- required: image_url
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [4..30] default=5
  - `image_url`: string (URL)
  - `resolution`: string 480p|720p default=720p
  - `bitrate_mode`: string standard|high default=high
  - `end_image_url`: string (URL)
  - `generate_audio`: boolean default=true


### `bytedance/seedance-2.5/reference-to-video`  — Seedance 2.5 (image2video, video2video)
- summary: Seedance 2.5 Reference to Video generates videos from images, videos, or audio inputs with customizable duration, resolution, aspect ratio, and output format. It supports image-to-video and video-to-video transformations, allowing creative control through prompts and audio integration.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Token-metered pricing. Billable video tokens = ceil((input video seconds + generated video seconds) × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. At 480p or 720p, each 1,000 video tokens cost $0.0214 without video input or $0.01284 with video input (0.6× the standard rate). With video references, both input and generated video durations are billable. Rates shown are before any applicable customer discount.
- required:   (conditional: {"if":{"required":["image_urls"]},"then":null,"else":{"if":{"required":["video_urls"]},"else":{"required":["audio_urls"]}}})
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [4..30] default=5
  - `audio_urls`: array items[1..10]
  - `image_urls`: array items[1..30]
  - `resolution`: string 480p|720p default=720p
  - `video_urls`: array items[1..10]
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|21:9 default=16:9
  - `bitrate_mode`: string standard|high default=high
  - `generate_audio`: boolean default=true


### `bytedance/seedance-2.5/text-to-video`  — Seedance 2.5 (text2video)
- summary: Generates videos from text, images, video, and audio references, with optional audio generation. Supports videos up to 30 seconds with customizable resolution, aspect ratio, and output format.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (rule)
- pricing: Token-metered pricing. Billable video tokens = ceil((input video seconds + generated video seconds) × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. At 480p or 720p, each 1,000 video tokens cost $0.0214. Rates shown are before any applicable customer discount.
- required: prompt
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [4..30] default=5
  - `resolution`: string 480p|720p default=720p
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|21:9 default=16:9
  - `bitrate_mode`: string standard|high default=high
  - `output_format`: string mp4|mov default=mp4
  - `generate_audio`: boolean default=true


### `bytedance/seedance-2.5/video-edit`  — Seedance 2.5 (video2video)
- summary: Generate videos from text, images, video, and audio references, with clips up to 30 seconds. Animate images, edit or extend existing footage, and generate audio alongside your video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Token-metered pricing. Billable video tokens = ceil((input video seconds + generated video seconds) × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. Video input is required. At 480p or 720p, each 1,000 video tokens cost $0.01284. Both input and generated video durations are billable. Rates shown are before any applicable customer discount.
- required: prompt, video_url
- params:
  - `prompt`: string — Write your prompt here
  - `video_url`: string (URL)
  - `audio_urls`: array items[1..10]
  - `image_urls`: array items[1..30]
  - `resolution`: string 480p|720p default=720p
  - `video_urls`: array items[1..10]
  - `bitrate_mode`: string standard|high default=high
  - `generate_audio`: boolean default=true


### `bytedance/seedance-2.5/video-extend`  — Seedance 2.5 (video2video)
- summary: Seedance 2.5 Video Extend generates extended video content from an input video URL and text prompt, supporting up to 30 seconds duration and optional audio or image inputs. It outputs videos in 480p or 720p resolution with mp4 or mov format, allowing control over audio generation and multiple media inputs.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Token-metered pricing. Billable video tokens = ceil((input video seconds + generated video seconds) × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. Video input is required. At 480p or 720p, each 1,000 video tokens cost $0.01284. Both input and generated video durations are billable. Rates shown are before any applicable customer discount.
- required: prompt, video_url
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [4..30] default=5
  - `video_url`: string (URL)
  - `audio_urls`: array items[1..10]
  - `image_urls`: array items[1..30]
  - `resolution`: string 480p|720p default=720p
  - `video_urls`: array items[1..10]
  - `bitrate_mode`: string standard|high default=high
  - `generate_audio`: boolean default=true


### `higgsfield-ai/soul/standard`  — Soul Standard (text2image)
- summary: Generates fashion and lifestyle photos from text, with style presets for editorial and social content.
- outputs: images | sample price (defaults, 2026-09-26): $0.094
- required: prompt
- params:
  - `seed`: integer [1..1000000]
  - `prompt`: string — Write your prompt here
  - `style_id`: string
  - `batch_size`: integer 1|4 default=1
  - `resolution`: string 720p|1080p default=720p
  - `aspect_ratio`: string 9:16|16:9|4:3|3:4|1:1|2:3|3:2 default=4:3
  - `enhance_prompt`: boolean default=true
  - `style_strength`: number [0..1] default=1


### `higgsfield-ai/soul/v2/standard`  — Soul 2 (text2image)
- summary: Generates realistic portraits and fashion images, with natural textures and curated editorial styles.
- outputs: images | sample price (defaults, 2026-09-26): $0.004
- required: prompt
- params:
  - `seed`: integer [1..1000000]
  - `prompt`: string — Write your prompt here
  - `style_id`: string
  - `batch_size`: integer 1|4 default=1
  - `resolution`: string 720p|1080p default=720p
  - `aspect_ratio`: string 9:16|16:9|4:3|3:4|1:1|2:3|3:2 default=4:3
  - `enhance_prompt`: boolean default=true


### `higgsfield/cinema-studio/4.0`  — Cinema Studio 4.0 (video2video)
- summary: Generates cinematic videos from text, image, or video references with automatic scene direction. Supports videos up to 30 seconds, optional sound, and customizable resolution and aspect ratio.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Token-metered pricing. Billable video tokens = ceil((input video seconds + generated video seconds) × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. At 480p or 720p, each 1,000 video tokens cost $0.0214 without video input or $0.01284 with video input (0.6× the standard rate). With video references, both input and generated video durations are billable. Rates shown are before any applicable customer discount.
- required: prompt
- params:
  - `era`: string 1960s|1980s|1990s|2000s|2020s
  - `genre`: string epic|drama|noir|comedy|horror|action
  - `light`: string silhouette|practicals|window|overhead-fall|contre-jour|soft-cross
  - `pacing`: string chaotic|dynamic|calm|single-shot
  - `prompt`: string
  - `duration`: integer [4..30] default=5
  - `audio_urls`: array items[0..10]
  - `image_urls`: array items[0..30]
  - `resolution`: string 480p|720p default=720p
  - `video_urls`: array items[0..10]
  - `camera_lens`: string clean-sharp|anamorphic|vintage-anamorphic|warm-vintage|halation-vintage
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|21:9 default=16:9
  - `camera_model`: string modern|35mm-film|8mm-film|dv-camcorder
  - `color_palette`: string static-noon|twilight-fable|back-row-kissing-seats|on-the-other-side-of-the-porthole|the-emerald-ambush|highway-standoff|the-faded-fresco|oil-ochre|the-mountain-convent|ghost-in-the-code|pink-velvet|two-days-to-the-horizon|industrial-fog|stairs-go-up|field-post|home-is-the-next-gas-station|glossy-flesh|the-crimson-ballet|neon-rain-at-midnight|the-morning-after-rain|the-iron-borough|the-ground|the-investigation|turquoise-mirage|a-dream-in-color|breakfast-on-schedule|favela-gold|a-hotel-for-one|after-dark|crimson-vigi|the-neighbors-saw-everything|the-grey-channel|mirage-at-noon|bubblegum-boulevard|yellow-room|the-earth-keeps-things-reluctantly|tropic-fever-dream|bioluminescent-night|dont-turn-it-off-im-watching|the-silk-curtain-falls|the-butterfly|playtime|wallpaper-romance|overtime|the-way-home-is-longer|everyone-speaks-in-whispers|runaway-summer|amber-wasteland|the-circus|gasoline-sunset
  - `generate_audio`: boolean default=true
  - `camera_aperture`: string f14-wide-open|f4-moderate|f11-deep-focus
  - `camera_movement`: string snorricam|robot-arm|tilt-up|rack-focus|tilt-down|pov|pan-left|crane-up|pan-right|crane-down|side-tracking|pedestal-up|pedestal-down|handheld|tracking|drone-orbit|dolly-zoom|aerial-pullback|static-shot|bullet-time|whip-pan|slow-zoom-in|arc-left|slow-zoom-out|arc-right|truck-right|dolly-in|truck-left|dolly-out|slider-right|crush-zoom|slider-left|helicopter-shot


### `higgsfield/genjutsu/motion-transfer/v1.0`  — Genjutsu Motion Transfer (video2video)
- summary: Transforms existing videos using image references for different characters, locations, and styles, preserving the original motion, camera movement, and timing throughout the resulting video clip.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Per-second pricing. Each second of input video costs $0.318 at 480p or $0.681 at 720p. Input duration is rounded up to the nearest whole second. Rates shown are before any applicable customer discount.
- required: video_url, image_urls
- params:
  - `prompt`: string maxLen=10000 default=
  - `video_url`: string maxLen=2083 (URL)
  - `image_urls`: array items[1..8]
  - `resolution`: string 720p|480p default=720p


### `higgsfield/genjutsu/object-swap/v1.0`  — Genjutsu Object Swap (video2video)
- summary: One video. Endless ways to reimagine it.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Per-second pricing. Each second of input video costs $0.318 at 480p or $0.681 at 720p. Input duration is rounded up to the nearest whole second. Rates shown are before any applicable customer discount.
- required: video_url, image_urls
- params:
  - `prompt`: string maxLen=10000 default=
  - `video_url`: string maxLen=2083 (URL)
  - `image_urls`: array items[1..8]
  - `resolution`: string 720p|480p default=720p


### `ideogram/v4.0`  — Ideogram 4.0 (image_edit, text2image)
- summary: Generates and edits images with multilingual text for posters, packaging and other graphic layouts.
- outputs: images | sample price (defaults, 2026-09-26): $0.060
- required: prompt
- params:
  - `prompt`: string maxLen=2048 — Write your prompt here
  - `image_url`: string (URL)
  - `aspect_ratio`: string 1:1|1:2|2:1|2:3|3:2|4:5|5:4|9:16|16:9|5:8|8:5|3:4|4:3|9:22|22:9|9:23|23:9|3:8|8:3|5:12|12:5|1:3|3:1 default=1:1
  - `image_weight`: integer [1..100] — How strongly the output should preserve the input image.
  - `rendering_speed`: string TURBO|DEFAULT|QUALITY default=DEFAULT


### `kling-video/motion-control/pro`  — Kling 2.6 (image2video)
- summary: Kling 2.6 Motion Control (Pro) generates videos by animating a source image using the motion from a provided video. Users can control character orientation and choose to retain the original video's sound for customized video creation.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (estimate-error)
- required: image_url, video_url
- params:
  - `prompt`: string default= — Write your prompt here
  - `image_url`: string (URL)
  - `video_url`: string (URL)
  - `keep_original_sound`: string yes|no default=yes
  - `character_orientation`: string image|video default=video — Generate the orientation of the characters in the video, which can be selected to match the image or the video


### `kling-video/motion-control/std`  — Kling 2.6 (image2video)
- summary: Kling 2.6 Motion Control (Standard) generates videos by animating a source image using motion from a reference video. Users provide an image URL and a video URL, with options to keep the original sound and align character orientation to either the image or video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (estimate-error)
- required: image_url, video_url
- params:
  - `prompt`: string default= — Write your prompt here
  - `image_url`: string (URL)
  - `video_url`: string (URL)
  - `keep_original_sound`: string yes|no default=yes
  - `character_orientation`: string image|video default=video — Generate the orientation of the characters in the video, which can be selected to match the image or the video


### `kling-video/o3/first-last-frame`  — Kling O3 (image2video)
- summary: Generates and edits videos using image or video references, multi-shot scenes and native sound.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.308
- required:   (conditional: {"if":{"properties":{"multi_shots":{"const":true}}},"then":{"required":["multi_prompt","first_frame_url"]},"else":{"required":["prompt","first_frame_url"]}})
- params:
  - `mode`: string std|pro|4k default=pro
  - `sound`: string on|off default=off
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `multi_shots`: boolean default=false
  - `aspect_ratio`: string 16:9|9:16|1:1
  - `multi_prompt`: array items[1..6] items={"prompt":{"type":"string","maxLength":512},"duration":{"type":"integer","maximum":15,"minimum":1}}
  - `last_frame_url`: string (URL)
  - `first_frame_url`: string (URL)


### `kling-video/o3/image-reference`  — Kling O3 (image2video)
- summary: Kling O3 Image Reference generates videos from one or multiple images using customizable prompts and settings like duration, aspect ratio, and sound. It supports both single and multi-shot workflows with options for intelligent or customized shot types.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.231
- required:   (conditional: {"if":{"properties":{"multi_shots":{"const":true}}},"then":{"required":["multi_prompt"]},"else":{"required":["prompt"]}})
- params:
  - `mode`: string std|pro|4k default=std
  - `sound`: string on|off default=off
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `elements`: array
  - `shot_type`: string customize|intelligent default=customize
  - `image_urls`: array
  - `multi_shots`: boolean default=false
  - `aspect_ratio`: string 16:9|9:16|1:1
  - `multi_prompt`: array items[1..6] items={"prompt":{"type":"string","maxLength":512},"duration":{"type":"integer","maximum":15,"minimum":0}}
  - `last_frame_url`: string (URL)
  - `first_frame_url`: string (URL)


### `kling-video/o3/video-edit`  — Kling O3 (image2video)
- summary: Kling O3 Video Edit generates edited videos from a single input video URL and optional images or elements, guided by a text prompt. Users can select modes including standard, professional, or 4K to customize output quality.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (estimate-error)
- required: prompt, video_urls
- params:
  - `mode`: string std|pro|4k default=pro
  - `prompt`: string — Write your prompt here
  - `elements`: array items[0..4]
  - `image_urls`: array items[0..4]
  - `video_urls`: array items[1..1]


### `kling-video/o3/video-reference`  — Kling O3 (image2video)
- summary: Kling O3 Video Reference generates videos based on a text prompt and a single reference video URL. Users can customize duration, aspect ratio, and optionally include images or elements to influence the output.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.462
- required: prompt, video_urls
- params:
  - `mode`: string std|pro default=pro
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..10] default=5
  - `elements`: array items[0..4]
  - `image_urls`: array items[0..4]
  - `video_urls`: array items[1..1]
  - `aspect_ratio`: string 16:9|9:16|1:1


### `kling-video/omni/first-last-frame`  — Kling Omni (image2video)
- summary: Generates and edits videos using image or video references and controls for start and end frames.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.308
- required: prompt, first_frame_url
- params:
  - `mode`: string std|pro default=pro
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10 default=5
  - `aspect_ratio`: string 16:9|9:16|1:1 default=16:9
  - `last_frame_url`: string (URL)
  - `first_frame_url`: string (URL)


### `kling-video/omni/image-reference`  — Kling Omni (image2video)
- summary: Kling Omni Image Reference generates videos from images and text prompts, allowing customization of duration, aspect ratio, and elements. It supports modes for standard or professional output, making it suitable for creating dynamic video content from static images.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.308
- required: prompt
- params:
  - `mode`: string std|pro default=pro
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..10] default=5
  - `elements`: array
  - `image_urls`: array
  - `aspect_ratio`: string 16:9|9:16|1:1 default=16:9


### `kling-video/omni/video-edit`  — Kling Omni (image2video)
- summary: Kling Omni Video Edit enables video generation from a single input video URL combined with text prompts and optional images or elements. Users can select between standard and pro modes to customize the editing process.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (estimate-error)
- required: prompt, video_urls
- params:
  - `mode`: string std|pro default=pro
  - `prompt`: string — Write your prompt here
  - `elements`: array items[0..4]
  - `image_urls`: array items[0..4]
  - `video_urls`: array items[1..1]


### `kling-video/omni/video-reference`  — Kling Omni (image2video)
- summary: Kling Omni Video Reference generates videos from a single input video URL combined with a text prompt and optional images or elements. It supports customizable duration and aspect ratios, enabling creative video synthesis based on reference footage.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.462
- required: prompt, video_urls
- params:
  - `mode`: string std|pro default=pro
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..10] default=5
  - `elements`: array items[0..4]
  - `image_urls`: array items[0..4]
  - `video_urls`: array items[1..1]
  - `aspect_ratio`: string 16:9|9:16|1:1 default=16:9


### `kling-video/v2.5-turbo/pro/image-to-video`  — Kling 2.5 Turbo Pro (image2video)
- summary: Kling 2.5 Turbo Pro converts a single image into a short video clip using a text prompt to guide the animation style. Users can specify video duration, CFG scale for prompt adherence, and provide negative prompts to refine output.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.193
- required: prompt, image_url
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10 default=5
  - `cfg_scale`: number [0..1] default=0.5
  - `image_url`: string (URL)
  - `negative_prompt`: string default=


### `kling-video/v2.5-turbo/pro/text-to-video`  — Kling 2.5 Turbo Pro (text2video)
- summary: Provides high-end text-to-video output featuring seamless movement, cinematic-quality imagery, and standout prompt fidelity
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.193
- required: prompt
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10 default=5
  - `cfg_scale`: number [0..1] default=0.5
  - `negative_prompt`: string default=


### `kling-video/v2.5-turbo/standard/image-to-video`  — Kling 2.5 Turbo Standard (image2video)
- summary: Generates videos from text prompts and images, with fast generation and precise prompt control.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.116
- required: prompt, image_url
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10 default=5
  - `cfg_scale`: number [0..1] default=0.5
  - `image_url`: string (URL)
  - `negative_prompt`: string default=


### `kling-video/v2.6/pro/image-to-video`  — Kling 2.6 Pro (image2video)
- summary: Kling 2.6 Pro Image to Video generates short videos from a single image URL using a text prompt to guide the transformation. Users can customize video duration, aspect ratio, sound inclusion, and CFG scale to control creativity and output style.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.385
- required: prompt, image_url
- params:
  - `sound`: string on|off default=on
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10 default=5
  - `cfg_scale`: number [0..1] default=0.5
  - `image_url`: string (URL)
  - `aspect_ratio`: string 16:9|9:16|1:1


### `kling-video/v2.6/pro/text-to-video`  — Kling 2.6 Pro (text2video)
- summary: Generates videos and sound from text or images, including dialogue, sound effects and ambience.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.385
- required: prompt
- params:
  - `sound`: string on|off default=on
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10 default=5
  - `cfg_scale`: number [0..1] default=0.5
  - `aspect_ratio`: string 16:9|9:16|1:1 default=16:9


### `kling-video/v3/motion-control/pro`  — Kling 3.0 (image2video)
- summary: Kling 3.0 Motion Control (Pro) generates videos by animating a source image according to the motion in a provided video. Users can control character orientation and choose to retain the original video's sound for customized motion-driven video creation.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (estimate-error)
- required: image_url, video_url
- params:
  - `prompt`: string default= — Write your prompt here
  - `image_url`: string (URL)
  - `video_url`: string (URL)
  - `keep_original_sound`: string yes|no default=yes
  - `character_orientation`: string image|video default=video — Generate the orientation of the characters in the video, which can be selected to match the image or the video


### `kling-video/v3/motion-control/std`  — Kling 3.0 (image2video)
- summary: Kling 3.0 Motion Control (Standard) generates videos by animating a source image according to the motion in a provided video. Users can control character orientation and choose to retain the original video's sound for customized video creation.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (estimate-error)
- required: image_url, video_url
- params:
  - `prompt`: string default= — Write your prompt here
  - `image_url`: string (URL)
  - `video_url`: string (URL)
  - `keep_original_sound`: string yes|no default=yes
  - `character_orientation`: string image|video default=video — Generate the orientation of the characters in the video, which can be selected to match the image or the video


### `kling-video/v3.0/4k/image-to-video`  — Kling 3.0 4k (image2video)
- summary: Kling 3.0 4K converts a single image URL into a video up to 15 seconds long, with optional sound generation and multi-shot or multi-prompt support. Users can customize duration, prompts, and configuration scale to influence the video output.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $1.155
- required: image_url
- params:
  - `sound`: string on|off default=on
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `elements`: array
  - `cfg_scale`: number [0..1] default=0.5
  - `image_url`: string (URL)
  - `multi_shots`: boolean default=false
  - `multi_prompt`: array items[0..6] items={"prompt":{"type":"string","maxLength":512},"duration":{"type":"integer","maximum":15,"minimum":1}}
  - `last_image_url`: string (URL)


### `kling-video/v3.0/4k/text-to-video`  — Kling 3.0 (text2video)
- summary: Generates videos from text or images, with optional audio generation and output in 4K resolution. Supports multi-shot sequences, start and end frames, and video durations from 3 to 15 seconds.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $1.155
- required: 
- params:
  - `sound`: string on|off default=on
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `elements`: array
  - `cfg_scale`: number [0..1] default=0.5
  - `multi_shots`: boolean default=false
  - `aspect_ratio`: string 16:9|9:16|1:1 default=16:9
  - `multi_prompt`: array items[0..6] items={"prompt":{"type":"string","maxLength":512},"duration":{"type":"integer","maximum":15,"minimum":1}}


### `kling-video/v3.0/pro/image-to-video`  — Kling 3.0 Pro (image2video)
- summary: Kling 3.0 Image to Video (Pro) generates videos from a single image URL with optional sound and customizable duration up to 15 seconds. It supports multi-shot sequences with multiple prompts and fine-tuning via CFG scale for creative video outputs.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.462
- required: image_url
- params:
  - `sound`: string on|off default=on
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `elements`: array
  - `cfg_scale`: number [0..1] default=0.5
  - `image_url`: string (URL)
  - `multi_shots`: boolean default=false
  - `multi_prompt`: array items[0..6] items={"prompt":{"type":"string","maxLength":512},"duration":{"type":"integer","maximum":15,"minimum":1}}
  - `last_image_url`: string (URL)


### `kling-video/v3.0/pro/text-to-video`  — Kling 3.0 Pro (text2video)
- summary: Kling 3.0 Text to Video (Pro) generates videos from text prompts with customizable duration, aspect ratio, and sound options. It supports multi-shot sequences and fine-tuning via CFG scale for creative video outputs.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.462
- required: 
- params:
  - `sound`: string on|off default=on
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `elements`: array
  - `cfg_scale`: number [0..1] default=0.5
  - `multi_shots`: boolean default=false
  - `aspect_ratio`: string 16:9|9:16|1:1 default=16:9
  - `multi_prompt`: array items[0..6] items={"prompt":{"type":"string","maxLength":512},"duration":{"type":"integer","maximum":15,"minimum":1}}


### `kling-video/v3.0/std/image-to-video`  — Kling 3.0 Standard (image2video)
- summary: Kling 3.0 Standard converts a single image URL into a video clip with optional sound and customizable duration up to 15 seconds. Users can enhance the output with prompts, multiple shots, and control the CFG scale for creative variation.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.347
- required: image_url
- params:
  - `sound`: string on|off default=on
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `elements`: array
  - `cfg_scale`: number [0..1] default=0.5
  - `image_url`: string (URL)
  - `multi_shots`: boolean default=false
  - `multi_prompt`: array items[1..6] items={"prompt":{"type":"string","maxLength":512},"duration":{"type":"integer","maximum":15,"minimum":1}}
  - `last_image_url`: string (URL)


### `kling-video/v3.0/std/text-to-video`  — Kling 3.0 Standard (text2video)
- summary: Generates multi-shot videos from text or images, with native audio and durations up to 15 seconds.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.347
- required: 
- params:
  - `sound`: string on|off default=on
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `elements`: array
  - `cfg_scale`: number [0..1] default=0.5
  - `multi_shots`: boolean default=false
  - `aspect_ratio`: string 16:9|9:16|1:1 default=16:9
  - `multi_prompt`: array items[1..6] items={"prompt":{"type":"string","maxLength":512},"duration":{"type":"integer","maximum":15,"minimum":1}}


### `kling-video/v3.0-turbo/image-to-video`  — Kling 3.0 Turbo (image2video)
- summary: Kling 3.0 Turbo converts a single image into a short video clip using a text prompt to guide the animation. Users can specify the video duration between 3 to 15 seconds and choose between 720p or 1080p resolution for output.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.308
- required: prompt, image_url
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `image_url`: string (URL)
  - `resolution`: string 720p|1080p default=720p


### `kling-video/v3.0-turbo/text-to-video`  — Kling 3.0 Turbo (text2video)
- summary: Kling 3.0 Turbo generates videos from text prompts, allowing customization of duration (3 to 15 seconds), resolution (720p or 1080p), and aspect ratio (16:9, 9:16, or 1:1). This variant focuses on efficient text-to-video creation with flexible output settings.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.308
- required: prompt
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `resolution`: string 720p|1080p default=720p
  - `aspect_ratio`: string 16:9|9:16|1:1 default=16:9


### `lightricks/ltx-2.5/image-to-video/fast`  — LTX-2.5 Fast (image2video)
- summary: LTX-2.5 Fast Image to Video on Runware with native audio and optional camera movement.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.540
- required: prompt, duration, image_url
- params:
  - `fps`: integer 24|25|48|50 default=25
  - `prompt`: string maxLen=5000 — Write your prompt here
  - `duration`: integer 6|8|10 default=6
  - `image_url`: string (URL)
  - `resolution`: string 720p|1080p|2k|4k default=720p
  - `aspect_ratio`: string 16:9|9:16 default=16:9
  - `end_image_url`: string (URL)
  - `generate_audio`: boolean default=true
  - `camera_movement`: string dolly_in|dolly_out|dolly_left|dolly_right|jib_up|jib_down|static|focus_shift


### `lightricks/ltx-2.5/image-to-video/pro`  — LTX-2.5 Pro (image2video)
- summary: LTX-2.5 Pro Image to Video on Runware with native audio and optional camera movement.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.720
- required: prompt, duration, image_url
- params:
  - `fps`: integer 24|25|50 default=25
  - `prompt`: string maxLen=5000 — Write your prompt here
  - `duration`: integer 6|8|10 default=6
  - `image_url`: string (URL)
  - `resolution`: string 720p|1080p default=720p
  - `aspect_ratio`: string 16:9|9:16 default=16:9
  - `end_image_url`: string (URL)
  - `generate_audio`: boolean default=true
  - `camera_movement`: string dolly_in|dolly_out|dolly_left|dolly_right|jib_up|jib_down|static|focus_shift


### `lightricks/ltx-2.5/text-to-video/fast`  — LTX-2.5 Fast (text2video)
- summary: Generates videos from text or images with native audio, camera motion controls and 4K resolution.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.540
- required: prompt, duration
- params:
  - `fps`: integer 24|25|48|50 default=25
  - `prompt`: string maxLen=5000 — Write your prompt here
  - `duration`: integer 6|8|10 default=6
  - `resolution`: string 720p|1080p|2k|4k default=720p
  - `aspect_ratio`: string 16:9|9:16 default=16:9
  - `generate_audio`: boolean default=true
  - `camera_movement`: string dolly_in|dolly_out|dolly_left|dolly_right|jib_up|jib_down|static|focus_shift


### `lightricks/ltx-2.5/text-to-video/pro`  — LTX-2.5 Pro (text2video)
- summary: Generates videos from text or images with native audio, camera motion controls and 1080p output.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.720
- required: prompt, duration
- params:
  - `fps`: integer 24|25|50 default=25
  - `prompt`: string maxLen=5000 — Write your prompt here
  - `duration`: integer 6|8|10 default=6
  - `resolution`: string 720p|1080p default=720p
  - `aspect_ratio`: string 16:9|9:16 default=16:9
  - `generate_audio`: boolean default=true
  - `camera_movement`: string dolly_in|dolly_out|dolly_left|dolly_right|jib_up|jib_down|static|focus_shift


### `marketing-studio/image/flare`  — Marketing Studio Image (image_edit, text2image)
- summary: Generate and edit Marketing Studio images with GPT Image 2.5 Flare.
- outputs: images | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Per 1M tokens: text input $5, cached text input $1.25, text output $10; image input $8, cached image input $2, image output $30. Quality defaults to high. Final cost uses actual token usage and standard credit rounding. The initial charge is an estimate reconciled on completion.
- required: prompt  (allOf: [{"if":{"required":["enhance_prompt"],"properties":{"enhance_prompt":{"const":true}}},"then":{"required":["preset_id","image_urls"],"properties":{"image_urls":{"maxItems":2,"minItems":1}}}}])
- params:
  - `prompt`: string maxLen=5000 — Write your prompt here
  - `quality`: string low|medium|high|xhigh|max default=high
  - `preset_id`: string
  - `image_urls`: array items[0..16]
  - `moderation`: string auto|low default=auto
  - `resolution`: string 1k|2k|4k default=2k
  - `aspect_ratio`: string auto|1:1|3:2|2:3|4:3|3:4|16:9|9:16|21:9 default=auto
  - `enhance_prompt`: boolean default=false


### `marketing-studio/image/sunburst`  — Marketing Studio Image (image_edit, text2image)
- summary: Generate and edit Marketing Studio images with GPT Image 2.5 Sunburst.
- outputs: images | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Per 1M tokens: text input $5, cached text input $1.25, text output $10; image input $8, cached image input $2, image output $30. Quality defaults to high. Final cost uses actual token usage and standard credit rounding. The initial charge is an estimate reconciled on completion.
- required: prompt  (allOf: [{"if":{"required":["enhance_prompt"],"properties":{"enhance_prompt":{"const":true}}},"then":{"required":["preset_id","image_urls"],"properties":{"image_urls":{"maxItems":2,"minItems":1}}}}])
- params:
  - `prompt`: string maxLen=5000 — Write your prompt here
  - `quality`: string low|medium|high|xhigh|max default=high
  - `preset_id`: string
  - `image_urls`: array items[0..16]
  - `moderation`: string auto|low default=auto
  - `resolution`: string 1k|2k|4k default=2k
  - `aspect_ratio`: string auto|1:1|3:2|2:3|4:3|3:4|16:9|9:16|21:9 default=auto
  - `enhance_prompt`: boolean default=false


### `marketing-studio/image`  — Marketing Studio Image (image_edit, text2image)
- summary: Generates and edits campaign images from text and image inputs, with resolutions from 1K to 4K. Preset mode uses a product photo and an optional model reference to guide the resulting image.
- outputs: images | sample price (defaults, 2026-09-26): $0.439
- required: prompt  (allOf: [{"if":{"required":["enhance_prompt"],"properties":{"enhance_prompt":{"const":true}}},"then":{"required":["preset_id","image_urls"],"properties":{"quality":{"const":"high"},"image_urls":{"maxItems":2,"minItems":1}}}}])
- params:
  - `prompt`: string maxLen=5000 — Write your prompt here
  - `quality`: string low|medium|high default=high
  - `preset_id`: string
  - `image_urls`: array items[0..16]
  - `moderation`: string auto|low default=auto
  - `resolution`: string 1k|2k|4k default=2k
  - `aspect_ratio`: string auto|1:1|3:2|2:3|4:3|3:4|16:9|9:16|21:9 default=auto
  - `enhance_prompt`: boolean default=false


### `minimax/h3/image-to-video`  — MiniMax H3 (image2video)
- summary: MiniMax H3 / Hailuo-03 preview integration using Video Generation V2.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.455
- required: prompt, image_url
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [5..15] default=5
  - `image_url`: string (URL)
  - `resolution`: string 2K default=2K
  - `aspect_ratio`: string auto|adaptive|21:9|16:9|4:3|1:1|3:4|9:16 default=auto
  - `end_image_url`: string (URL)
  - `aigc_watermark`: boolean default=false


### `minimax/h3/reference-to-video`  — MiniMax H3 (image2video, video2video)
- summary: MiniMax H3 generates videos from reference images or videos using Video Generation V2. Users provide prompts, reference media URLs, and optional audio to create videos up to 15 seconds with customizable resolution and aspect ratio.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: 2K output costs $0.13 per generated second. The first five reference images are included; each additional reference image costs $0.08. Rates shown are before any applicable customer discount.
- required: prompt  (conditional: {"if":{"required":["image_urls"]},"then":null,"else":{"required":["video_urls"]}})
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [5..15] default=5
  - `audio_urls`: array items[0..3]
  - `image_urls`: array items[1..9]
  - `resolution`: string 2K default=2K
  - `video_urls`: array items[1..3]
  - `aspect_ratio`: string auto|adaptive|21:9|16:9|4:3|1:1|3:4|9:16 default=auto
  - `aigc_watermark`: boolean default=false


### `minimax/h3/text-to-video`  — MiniMax H3 (text2video)
- summary: Generates 2K videos up to 15 seconds using text, image, video, and optional audio reference files.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.455
- required: prompt
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [5..15] default=5
  - `resolution`: string 2K default=2K
  - `aspect_ratio`: string auto|adaptive|21:9|16:9|4:3|1:1|3:4|9:16 default=auto
  - `aigc_watermark`: boolean default=false


### `minimax/hailuo-2.3/standard/image-to-video`  — MiniMax Hailuo 2.3 Standard (image2video)
- summary: MiniMax Hailuo 2.3 Standard converts a single image into a short video clip of 6 or 10 seconds based on a text prompt. Users provide an image URL and optional prompt optimization to guide the video generation process.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.070
- required: prompt, image_url
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer 6|10 default=6
  - `image_url`: string (URL)
  - `prompt_optimizer`: boolean default=true


### `minimax/hailuo-2.3/standard/text-to-video`  — MiniMax Hailuo 2.3 Standard (text2video)
- summary: Generates short videos from text or images with fluid body motion and natural facial expressions.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.070
- required: prompt
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer 6|10 default=6
  - `prompt_optimizer`: boolean default=true


### `recraft/v4.1/pro/text-to-image`  — Recraft V4.1 Pro (text2image)
- summary: Recraft V4.1 Pro generates images from text prompts with customizable resolution, aspect ratio, output format, and color options. Users can specify background and palette colors to tailor the visual style of the output.
- outputs: images | sample price (defaults, 2026-09-26): $0.210
- required: prompt
- params:
  - `colors`: array items={"rgb":{"type":"array","items":{"type":"integer","maximum":255,"minimum":0},"maxItems":3,"minItems":3}}
  - `prompt`: string maxLen=10000 — Write your prompt here
  - `resolution`: string 2k default=2k
  - `aspect_ratio`: string 1:1|2:1|1:2|3:2|2:3|4:3|3:4|5:4|4:5|6:10|14:10|10:14|16:9|9:16 default=1:1
  - `output_format`: string jpg|png|webp default=jpg
  - `background_color`: object


### `recraft/v4.1/text-to-image`  — Recraft V4.1 (text2image)
- summary: Generates images and illustrations using custom palettes and background colors to fit your brand.
- outputs: images | sample price (defaults, 2026-09-26): $0.035
- required: prompt
- params:
  - `colors`: array items={"rgb":{"type":"array","items":{"type":"integer","maximum":255,"minimum":0},"maxItems":3,"minItems":3}}
  - `prompt`: string maxLen=10000 — Write your prompt here
  - `resolution`: string 1k default=1k
  - `aspect_ratio`: string 1:1|2:1|1:2|3:2|2:3|4:3|3:4|5:4|4:5|6:10|14:10|10:14|16:9|9:16 default=1:1
  - `output_format`: string jpg|png|webp default=jpg
  - `background_color`: object


### `recraft/v4.1/utility/pro/text-to-image`  — Recraft V4.1 Utility Pro (text2image)
- summary: Recraft V4.1 Utility Pro generates images from text prompts with customizable resolution, aspect ratio, output format, and color options. Users can specify background colors and a palette of colors to influence the image creation process.
- outputs: images | sample price (defaults, 2026-09-26): $0.210
- required: prompt
- params:
  - `colors`: array items={"rgb":{"type":"array","items":{"type":"integer","maximum":255,"minimum":0},"maxItems":3,"minItems":3}}
  - `prompt`: string maxLen=10000 — Write your prompt here
  - `resolution`: string 2k default=2k
  - `aspect_ratio`: string 1:1|2:1|1:2|3:2|2:3|4:3|3:4|5:4|4:5|6:10|14:10|10:14|16:9|9:16 default=1:1
  - `output_format`: string jpg|png|webp default=jpg
  - `background_color`: object


### `recraft/v4.1/utility/text-to-image`  — Recraft V4.1 Utility (text2image)
- summary: Recraft V4.1 Utility generates images from text prompts with customizable resolution, aspect ratio, output format, and color options including background and palette colors. This variant focuses on utility features for precise control over image attributes.
- outputs: images | sample price (defaults, 2026-09-26): $0.035
- required: prompt
- params:
  - `colors`: array items={"rgb":{"type":"array","items":{"type":"integer","maximum":255,"minimum":0},"maxItems":3,"minItems":3}}
  - `prompt`: string maxLen=10000 — Write your prompt here
  - `resolution`: string 1k default=1k
  - `aspect_ratio`: string 1:1|2:1|1:2|3:2|2:3|4:3|3:4|5:4|4:5|6:10|14:10|10:14|16:9|9:16 default=1:1
  - `output_format`: string jpg|png|webp default=jpg
  - `background_color`: object


### `soul-id`  — Soul ID (character)
- summary: 
- outputs: images | sample price (defaults, 2026-09-26): n/a (no-inputs)
- required: 
- params:



### `wan/v2.6/image-to-video`  — Wan 2.6 (image2video)
- summary: Wan 2.6 - Image to Video. Configured Alibaba route; cloned from wan-26/image-to-video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.250
- required: prompt, image_url
- params:
  - `seed`: integer [-1..10000000]
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10|15 default=5
  - `audio_url`: string (URL)
  - `image_url`: string (URL)
  - `resolution`: string 480p|720p|1080p default=720p
  - `multi_shots`: boolean default=false
  - `prompt_extend`: boolean default=false
  - `negative_prompt`: string default=


### `wan/v2.6/reference-to-video`  — Wan 2.6 (image2video)
- summary: Wan 2.6 - Reference to Video. Configured Alibaba route; cloned from wan-26/references-to-video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.250
- required: prompt, video_urls
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10 default=5
  - `resolution`: string 720p|1080p default=720p
  - `video_urls`: array items[1..3]
  - `aspect_ratio`: string 16:9|9:16|1:1|4:3|3:4 default=16:9


### `wan/v2.6/text-to-video`  — Wan 2.6 (text2video)
- summary: Generates multi-shot videos from text or images with native sound and optional video references.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.250
- required: prompt
- params:
  - `seed`: integer [-1..10000000]
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10|15 default=5
  - `audio_url`: string (URL)
  - `resolution`: string 720p|1080p default=720p
  - `multi_shots`: boolean default=false
  - `prompt_extend`: boolean default=false


### `wan/v2.7/image-to-video`  — Wan 2.7 (image2video)
- summary: Wan 2.7 - Image to Video. Configured Alibaba route; cloned from wan-27/image-to-video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.250
- required: image_url
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..15] default=5
  - `audio_url`: string (URL)
  - `image_url`: string (URL)
  - `resolution`: string 720p|1080p default=720p
  - `end_image_url`: string (URL)
  - `prompt_extend`: boolean default=false
  - `negative_prompt`: string default=


### `wan/v2.7/reference-to-video`  — Wan 2.7 (image2video)
- summary: Wan 2.7 - Reference to Video. Configured Alibaba route; cloned from wan-27/reference-to-video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.250
- required: prompt  (conditional: {"if":{"required":["image_urls"],"properties":{"image_urls":{"type":"array","minItems":1}}},"then":null,"else":{"required":["video_urls"],"properties":{"video_urls":{"type":"array","minItems":1}}}})
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..10] default=5
  - `image_urls`: array
  - `resolution`: string 720p|1080p default=720p
  - `video_urls`: array
  - `aspect_ratio`: string 16:9|9:16 default=16:9
  - `prompt_extend`: boolean default=false
  - `negative_prompt`: string default=


### `wan/v2.7/text-to-video`  — Wan 2.7 (text2video)
- summary: Generates videos from text or images with native audio and consistent characters across scenes.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.250
- required: prompt
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..15] default=5
  - `audio_url`: string (URL)
  - `resolution`: string 720p|1080p default=720p
  - `aspect_ratio`: string 16:9|9:16|1:1|4:3|3:4 default=16:9
  - `prompt_extend`: boolean default=false
  - `negative_prompt`: string default=


### `xai/grok-imagine-image-2.0`  — Grok Imagine 2.0 (image_edit, text2image)
- summary: Generates images and makes precise edits while preserving image details and visual consistency.
- outputs: images | sample price (defaults, 2026-09-26): $0.060
- required: prompt
- params:
  - `prompt`: string — Write your prompt here
  - `quality`: string low|medium default=medium
  - `image_urls`: array items[0..10]
  - `resolution`: string 1k|2k default=1k
  - `aspect_ratio`: string auto|1:1|1:2|2:1|3:2|2:3|4:3|3:4|16:9|9:16 default=auto


### `xai/grok-imagine-video/v1.5/reference-to-video`  — Grok Imagine Video 1.5 (image2video, text2video)
- summary: Creates videos from text prompts or still images, with 1080p resolution and clips up to 15 seconds.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.400
- required: prompt
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [1..15] default=5
  - `audio_url`: string (URL)
  - `image_url`: string (URL)
  - `image_urls`: array items[0..7]
  - `resolution`: string 480p|720p|1080p default=480p
  - `aspect_ratio`: string auto|1:1|16:9|9:16|4:3|3:4|3:2|2:3 default=auto


### `z-image/turbo`  — Z-Image Turbo (text2image)
- summary: Generates images quickly with clear Chinese and English text rendering and PNG output up to 2K.
- outputs: images | sample price (defaults, 2026-09-26): $0.015
- required: prompt
- params:
  - `seed`: integer [0..2147483647] — Optional random seed for similar, reproducible results.
  - `prompt`: string maxLen=800 — Positive prompt describing the desired content, style, and composition.
  - `resolution`: string 1k|2k default=1k — Output resolution tier. Both tiers produce PNG images.
  - `aspect_ratio`: string 1:1|2:3|3:2|3:4|4:3|7:9|9:7|9:16|16:9|21:9 default=1:1 — Output aspect ratio. Exact provider-recommended dimensions are selected automatically.
  - `prompt_extend`: boolean default=false — Rewrite and reason over the prompt before generation; this uses the enhanced price tier.


