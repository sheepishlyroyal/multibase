# Deploying the Cloud Functions

Multibase's Cloud Functions live in `cloud-functions/*.example.js`. They're
deliberately **not** imported by the client library — they run on Google's
servers.

## First-time setup

```bash
# Install the Firebase CLI globally
npm install -g firebase-tools
firebase login

# Initialise Functions in a NEW folder outside the multibase repo
mkdir ../multibase-functions && cd ../multibase-functions
firebase init functions
# → Use an existing project → pick ONE of your shard projects
# → JavaScript (not TypeScript for these snippets)
# → ESLint: yes
# → Install dependencies now: yes
```

You'll end up with:

```
multibase-functions/
├── firebase.json
└── functions/
    ├── index.js
    ├── package.json
    └── node_modules/
```

## Add a function

Copy the example you want into `functions/index.js`:

```bash
cp ../multibase/cloud-functions/image-variants.example.js functions/index.js
```

Install its extra deps:

| Function              | Extra npm installs              |
|-----------------------|---------------------------------|
| `image-variants`      | `sharp`                         |
| `audio-transcode`     | `fluent-ffmpeg ffmpeg-static`   |
| `ttl-cleanup`         | *(none — Admin SDK is pre-installed)* |

## Run locally first

The Firebase Emulator Suite runs functions against local Firestore + Storage:

```bash
firebase emulators:start --only functions,firestore,storage
```

## Deploy

```bash
firebase deploy --only functions
```

## Multi-project deployment

Storage-triggered functions (`image-variants`, `audio-transcode`) fire on
**the project that received the upload**. So if your app uploads to
*any* of your Multibase shards, every shard needs the function:

```bash
firebase use your-project-1 && firebase deploy --only functions
firebase use your-project-2 && firebase deploy --only functions
# … one command per shard
```

`ttl-cleanup` is different — it's a scheduled function that connects to
every shard via the Admin SDK. Deploy it to **one** shard only (scheduler
invocations are free below 3/day).

## Cost sanity check

Spark (free plan) gives you, per month:

- 125 000 function invocations
- 40 000 GB-seconds (memory × time)
- 200 000 GHz-seconds (CPU × time)

Rough real-world numbers:

| Workload                          | Typical free-tier headroom |
|-----------------------------------|----------------------------|
| `image-variants` @ 100 uploads/day | comfortable                |
| `audio-transcode` @ 30 min audio/day | comfortable               |
| `ttl-cleanup` every 15 minutes     | trivial                    |

Watch the billing dashboard the first week; the big outliers are heavy
audio transcodes. Lower `memory` and `timeoutSeconds` to tighten usage.
