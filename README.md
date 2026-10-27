# ReVoice Audio — Clinical Speech Corpus Web Platform

**ReVoice Audio** is a research-grade web application engineered for collecting sentence-level acoustic speech corpora from participants. It features Indian 10-digit mobile number + OTP authentication, informed consent verification, a 3-level speech corpus, real-time waveform recording, local 16-bit Linear PCM WAV encoding, decoupled local system disk storage with database path pointers, administrator clinical review queues, deletion governance, and standardized research dataset export.

---

## 1. Technology Stack & Architecture

| Component | Technology | Rationale & Specifications |
| :--- | :--- | :--- |
| **Platform Target** | Responsive Web Application | Pure web-first responsive interface optimized for desktop, laptop, tablet, and mobile browsers with zero emulator or native app constraints. |
| **Frontend Framework** | React 19 + TypeScript + Vite | Component modularity, strict type safety, zero runtime overhead, and fast HMR-free production builds. |
| **Styling & Design** | Tailwind CSS v4 | Clean healthcare design system, high-contrast accessible typography (JetBrains Mono & Plus Jakarta Sans), zero-pill discipline, and WCAG AA compliance. |
| **Audio Capture** | Web Audio API (`AudioContext`, `AnalyserNode`, `MediaRecorder`) | Hardware microphone stream gating, acoustic speech echo cancellation, and real-time frequency-domain waveform visualization. |
| **Audio Format** | **16-bit Linear PCM RIFF/WAV (16,000 Hz, Mono)** | Uncompressed industry standard for ASR (Automated Speech Recognition), phoneme alignment, and clinical acoustic modeling (Whisper, Wav2Vec 2.0). |
| **Storage Architecture** | **Decoupled System Disk Storage (Path Pointers)** | Audio files are persisted in local system storage paths. The database stores **only** file path string pointers and acoustic metadata—keeping database payloads lightweight. |
| **Database** | IndexedDB (`ReVoiceAudioSpeechCorpusDB`, v3) | ACID client persistence with indices on `mobileNumber`, `participantId`, `sentenceId`, and `reviewStatus`. Seamlessly migratable to Cloud Firestore. |
| **Authentication** | 10-Digit Mobile + OTP & Web Cryptography (PBKDF2) | Registration via 10-digit mobile number with OTP verification. Passwords hashed using PBKDF2-SHA256 with 100,000 rounds and 16-byte random salts. |
| **Corpus Packaging** | JSZip | Standardized research exports containing audio directories, `corpus_manifest.csv`, `sentences_catalog_table.csv`, and `participant_metadata.json`. |

---

## 2. Authentication & Participant Onboarding

### 10-Digit Mobile Number + OTP Flow
1. **Registration:**
   - Participant enters their Name, 10-digit Indian Mobile Number (`+91`), Gender, Age, Cohort (Healthy or Speech-Impaired), and Password.
   - System dispatches a 6-digit cryptographic OTP (valid for 5 minutes).
   - An on-screen OTP notification banner allows 1-click auto-fill, with a 60-second cooldown timer for OTP resend.
   - Upon verification, an anonymized canonical Participant ID (e.g. `SPK0001`) is generated.
2. **Login:**
   - Participants can sign in using their registered 10-digit mobile number or permanent Participant ID.
   - Staff administrators sign in using their administrator email and secure password.
3. **Password Reset:**
   - Secure forgot password flow verifies the 10-digit mobile number via OTP before allowing password update.
4. **Firebase Phone Auth Ready:**
   - The UI and auth service are decoupled; once hosted on Firebase, Firebase Phone Authentication (`signInWithPhoneNumber` and Identity Platform) can be activated without altering the frontend interface.

---

## 3. Storage Architecture: Decoupled System Paths & GCS Readiness

ReVoice Audio separates binary audio file storage from database metadata:

```
/system_storage/recordings/
└── {participant_id}/
    └── level_{level_id}/
        └── {recording_id}.wav   <-- Binary 16kHz PCM WAV stored on disk
```

### Database Representation (Metadata Pointer Only)
The database record contains **no binary blobs**, preventing database bloat and staying well within cloud free-tier limits:

```json
{
  "id": "REC_SPK0001_L1S01",
  "recordingId": "REC_SPK0001_L1S01",
  "speakerId": "SPK0001",
  "userId": "usr_991823a-f10",
  "participantId": "SPK0001",
  "sentenceId": "l1_s01",
  "promptId": "L1_S01",
  "level": 1,
  "cohort": "healthy",
  "localFilePath": "/system_storage/recordings/SPK0001/level_1/REC_SPK0001_L1S01.wav",
  "audioFormat": "audio/wav",
  "sampleRate": 16000,
  "bitDepth": 16,
  "channelCount": 1,
  "duration": 4.82,
  "fileSize": 154200,
  "timestamp": 1740637200000,
  "reviewStatus": "pending",
  "submissionStatus": "submitted"
}
```

### 1-Click Save Audio to Computer Disk
- Both the participant **"My Audio"** screen and the administrator **"Dashboard Ledger"** feature a direct **Download WAV** button to immediately save any individual audio file from system storage directly to the local hard drive.
- Detailed modal views show the full canonical file path and Google Cloud Storage URI.

### Future Google Cloud Storage (GCS) Readiness
Configuration is centrally maintained in `src/services/storage/cloudStorageConfig.ts`:
- **GCS Cloud URI Format:** `gs://revoice-speech-corpus-prod/recordings/{participant_id}/level_{level}/{recording_id}.wav`
- When Google Cloud Storage is provisioned, switching `currentBackend = 'google_cloud_storage'` will route binary uploads to GCS buckets via Signed URLs while leaving the database schema and path references completely intact.

---

## 4. Multi-Level Corpus & Sequential Recording

- **Corpus Hierarchy:**
  - **Level 1 (Elementary):** 10 short everyday sentences for baseline vocal stability.
  - **Level 2 (Moderate):** 10 complex clinical sentences with varied phonetics.
  - **Level 3 (Advanced):** 10 rapid articulation and tongue-twister sentences for acoustic stress modeling.
- **Sequential Prompt Tracking:** Independent progression pointers for each level ensure participants record prompts in order while allowing freedom to switch difficulty tracks.
- **Real-Time Visualizer:** Live frequency waveform visualizer and hardware mic test widget before recording.

---

## 5. Governance, Deletion & Retake Lifecycle

1. **Post-Submission Protection:**
   - Once submitted, participants cannot unilaterally delete recordings to preserve research audit integrity.
   - Participants can click **"Request Deletion from Admin"** to file an erasure request with an optional reason.
2. **Administrator Review Queue:**
   - Mandatory Clinical Quality Checklist:
     1. Participant & Prompt ID Consistency
     2. WAV File Integrity & 16kHz Header
     3. Prompt Read Completely Without Clipping
     4. Speech Articulation & Phonetic Clarity
     5. Tolerable Background Noise
     6. Acoustic Metadata Accuracy
   - Actions: **Approve**, **Reject**, or **Request Retake**.
3. **Administrator Retake Workflow:**
   - If an admin flags a take as **"Retake Required"**, the participant receives an alert banner on their dashboard.
   - The retake option is automatically enabled for that prompt, allowing a fresh take without advancing sequence counters.
4. **Administrator Deletion Ledger:**
   - Admins inspect, approve, or reject withdrawal and data deletion requests, maintaining a permanent immutable audit trail.

---

## 6. Dataset Export

1. **Participant Export:**
   - Generates `{participant_id}_speech_corpus_{date}.zip` containing all user `.wav` files, `corpus_manifest.csv`, `sentences_catalog_table.csv`, and `participant_metadata.json`.
2. **Admin Verified Dataset Export:**
   - Packages only **clinically approved recordings with verified active consent** into `ReVoice_Verified_Corpus_{date}.zip` with an audit log entry.

---

## 7. Project Structure

```
src/
├── types/                     # Domain models (User, Consent, Sentence, Recording, DeletionRequest, AuditLog)
├── services/
│   ├── db.ts                  # IndexedDB database service (v3 schema with mobileNumber index)
│   ├── authService.ts         # PBKDF2 cryptography, 10-digit mobile + OTP session manager
│   ├── audioEncoder.ts        # 16-bit Linear PCM WAV encoder and 16kHz resampler
│   ├── audioStorageService.ts # Local system disk storage manager, disk download, ZIP exporter
│   ├── recordingRepository.ts # Domain recording operations, stats computation
│   ├── progressService.ts     # Sequential prompt advancement per difficulty level
│   ├── deletionService.ts     # Deletion & withdrawal request management
│   └── storage/
│       └── cloudStorageConfig.ts # Decoupled path generator & Google Cloud Storage adapter
├── hooks/
│   └── useAudioRecorder.ts    # Hardware mic lifecycle and frequency waveform stream
├── utils/
│   └── formatters.ts          # ID formats (REC_SPK0001_L1S01), durations, file sizes
├── data/
│   └── sampleSentences.ts     # Master 30-sentence clinical speech corpus catalog
└── components/
    ├── layout/                # TopAppBar (desktop web navigation) and BottomNavBar (mobile)
    ├── screens/               # WelcomeLogin, Consent, HomeDashboard, SentenceList, MyRecordings, ProfileSettings
    ├── admin/                 # AdminDashboard, AdminReviewQueue, AdminDeletionsScreen, AdminProfileScreen
    └── modals/                # RecordingModal, ReviewModal, RecordingDetailsModal
```

---

## 8. Development & Build

### Running Locally
```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Open `http://localhost:3000` in your web browser.

### Type-Checking & Linting
```bash
npm run lint
```

### Production Build
```bash
npm run build
```
The compiled static assets are generated in `dist/`.

---

## 9. Deployment Options (Zero Cost)

- **Firebase Hosting:**
  ```bash
  npm install -g firebase-tools
  firebase login
  firebase init hosting   # Set public directory to 'dist', configure as single-page app
  npm run build
  firebase deploy
  ```
- **Vercel / Netlify / Cloud Run:**
  - Connect your GitHub repository.
  - Set Build Command to `npm run build` and Output Directory to `dist`.
