/**
 * Firebase project configs — one entry per shard.
 *
 * THIS IS A TEMPLATE. To use the library:
 *
 *   cp multibase.config.example.js multibase.config.js
 *
 * Then edit your local `multibase.config.js` (which is gitignored) and fill
 * in the fields below with real values from the Firebase console.
 *
 * HOW TO GET THE VALUES:
 *   1. Create two or more Firebase projects at https://console.firebase.google.com.
 *   2. In each project, enable Firestore Database (Build → Firestore → Create).
 *   3. Register a Web app (⚙ → Project Settings → Your apps → </>).
 *   4. Copy each project's `firebaseConfig` object into the array below.
 *   5. Set Firestore rules on every project to allow your app to read and write
 *      (see README for a starter ruleset).
 *
 * Adding more configs = more combined storage, reads, and writes. The sharding
 * hash uses `array.length`, so the number you start with is baked in: changing
 * it later means migrating existing data to the new hash layout.
 */

export const FIREBASE_CONFIGS = [
  {
    apiKey: "REPLACE_WITH_PROJECT_1_API_KEY",
    authDomain: "your-project-1.firebaseapp.com",
    projectId: "your-project-1",
    storageBucket: "your-project-1.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:shard1appid",
  },
  {
    apiKey: "REPLACE_WITH_PROJECT_2_API_KEY",
    authDomain: "your-project-2.firebaseapp.com",
    projectId: "your-project-2",
    storageBucket: "your-project-2.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:shard2appid",
  },
  // Add a third, fourth, etc. to scale further:
  // {
  //   apiKey: "REPLACE_WITH_PROJECT_3_API_KEY",
  //   authDomain: "your-project-3.firebaseapp.com",
  //   projectId: "your-project-3",
  //   storageBucket: "your-project-3.appspot.com",
  //   messagingSenderId: "000000000000",
  //   appId: "1:000000000000:web:shard3appid",
  // },
];
