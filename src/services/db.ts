import {
  User,
  ConsentRecord,
  Sentence,
  Recording,
  AudioStorageFile,
  ParticipantProgress,
  DeletionRequest,
  AuditLog,
  ReviewRecord,
} from '../types';
import { getDefaultSentences } from '../data/sampleSentences';

const DB_NAME = 'ReVoiceAudioSpeechCorpusDB';
const DB_VERSION = 3;

/**
 * IndexedDB Relational Database Service (v3)
 * Provides robust object stores with indexes, transaction atomicity, and schema versioning.
 *
 * Dedicated Tables (Object Stores):
 * 1. 'sentences': Master catalog of speech corpus prompts (Key: 'id' / 'promptId')
 * 2. 'recordings': Audio recordings metadata linking each take to 'sentenceId' / 'promptId'
 * 3. 'users': Participant & Admin registration & identity table (Key: 'id', Indexed: 'participantId', 'email')
 * 4. 'consents': Informed consent records (Key: 'id', Indexed: 'userId')
 * 5. 'audio_files': Local binary linear PCM WAV storage (Key: 'path')
 * 6. 'participant_progress': Persistent prompt sequence & cohort progress (Key: 'userId')
 * 7. 'deletion_requests': Data deletion and withdrawal requests queue (Key: 'id', Indexed: 'userId', 'status')
 * 8. 'audit_logs': Administrative action audit trail (Key: 'id', Indexed: 'timestamp')
 * 9. 'reviews': Quality checklist & review decisions (Key: 'id', Indexed: 'recordingId')
 */
class DatabaseService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDatabase(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction;

        // 1. Users Store
        let userStore: IDBObjectStore;
        if (!db.objectStoreNames.contains('users')) {
          userStore = db.createObjectStore('users', { keyPath: 'id' });
        } else if (transaction) {
          userStore = transaction.objectStore('users');
        } else {
          userStore = (event.target as IDBOpenDBRequest).result.createObjectStore('users', { keyPath: 'id' });
        }
        if (!userStore.indexNames.contains('email')) {
          userStore.createIndex('email', 'email', { unique: true });
        }
        if (!userStore.indexNames.contains('participantId')) {
          userStore.createIndex('participantId', 'participantId', { unique: true });
        }
        if (!userStore.indexNames.contains('role')) {
          userStore.createIndex('role', 'role', { unique: false });
        }
        if (!userStore.indexNames.contains('mobileNumber')) {
          userStore.createIndex('mobileNumber', 'mobileNumber', { unique: false });
        }

        // 2. Consents Store
        if (!db.objectStoreNames.contains('consents')) {
          const consentStore = db.createObjectStore('consents', { keyPath: 'id' });
          consentStore.createIndex('userId', 'userId', { unique: false });
        }

        // 3. Sentences Store (Master Prompt ID Table)
        let sentenceStore: IDBObjectStore;
        if (!db.objectStoreNames.contains('sentences')) {
          sentenceStore = db.createObjectStore('sentences', { keyPath: 'id' });
        } else if (transaction) {
          sentenceStore = transaction.objectStore('sentences');
        } else {
          sentenceStore = (event.target as IDBOpenDBRequest).result.createObjectStore('sentences', { keyPath: 'id' });
        }
        if (!sentenceStore.indexNames.contains('promptId')) {
          sentenceStore.createIndex('promptId', 'promptId', { unique: false });
        }
        if (!sentenceStore.indexNames.contains('level')) {
          sentenceStore.createIndex('level', 'level', { unique: false });
        }
        if (!sentenceStore.indexNames.contains('sentenceNumber')) {
          sentenceStore.createIndex('sentenceNumber', 'sentenceNumber', { unique: false });
        }

        // 4. Recordings Metadata Store
        let recStore: IDBObjectStore;
        if (!db.objectStoreNames.contains('recordings')) {
          recStore = db.createObjectStore('recordings', { keyPath: 'id' });
        } else if (transaction) {
          recStore = transaction.objectStore('recordings');
        } else {
          recStore = (event.target as IDBOpenDBRequest).result.createObjectStore('recordings', { keyPath: 'id' });
        }
        if (!recStore.indexNames.contains('userId')) {
          recStore.createIndex('userId', 'userId', { unique: false });
        }
        if (!recStore.indexNames.contains('participantId')) {
          recStore.createIndex('participantId', 'participantId', { unique: false });
        }
        if (!recStore.indexNames.contains('sentenceId')) {
          recStore.createIndex('sentenceId', 'sentenceId', { unique: false });
        }
        if (!recStore.indexNames.contains('promptId')) {
          recStore.createIndex('promptId', 'promptId', { unique: false });
        }
        if (!recStore.indexNames.contains('level')) {
          recStore.createIndex('level', 'level', { unique: false });
        }
        if (!recStore.indexNames.contains('reviewStatus')) {
          recStore.createIndex('reviewStatus', 'reviewStatus', { unique: false });
        }
        if (!recStore.indexNames.contains('cohort')) {
          recStore.createIndex('cohort', 'cohort', { unique: false });
        }
        if (!recStore.indexNames.contains('user_sentence')) {
          recStore.createIndex('user_sentence', ['userId', 'sentenceId'], { unique: false });
        }

        // 5. Audio Files Binary Blob Store
        if (!db.objectStoreNames.contains('audio_files')) {
          db.createObjectStore('audio_files', { keyPath: 'path' });
        }

        // 6. Participant Progress Store (v3)
        if (!db.objectStoreNames.contains('participant_progress')) {
          db.createObjectStore('participant_progress', { keyPath: 'userId' });
        }

        // 7. Deletion Requests Store (v3)
        if (!db.objectStoreNames.contains('deletion_requests')) {
          const delStore = db.createObjectStore('deletion_requests', { keyPath: 'id' });
          delStore.createIndex('userId', 'userId', { unique: false });
          delStore.createIndex('status', 'status', { unique: false });
          delStore.createIndex('submissionDate', 'submissionDate', { unique: false });
        }

        // 8. Audit Logs Store (v3)
        if (!db.objectStoreNames.contains('audit_logs')) {
          const logStore = db.createObjectStore('audit_logs', { keyPath: 'id' });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 9. Reviews Store (v3)
        if (!db.objectStoreNames.contains('reviews')) {
          const revStore = db.createObjectStore('reviews', { keyPath: 'id' });
          revStore.createIndex('recordingId', 'recordingId', { unique: false });
          revStore.createIndex('reviewerId', 'reviewerId', { unique: false });
        }
      };

      request.onsuccess = async () => {
        const db = request.result;
        await this.seedDefaultSentences(db);
        await this.seedDefaultAdminAccount(db);
        resolve(db);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  private async seedDefaultSentences(db: IDBDatabase): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sentences', 'readwrite');
      const store = tx.objectStore('sentences');
      const getAllReq = store.getAll();

      getAllReq.onsuccess = () => {
        const existing = (getAllReq.result || []) as Sentence[];
        const needsUpdate =
          existing.length !== 30 ||
          existing.some((s) => !s.promptId || !s.instructionNotes || s.id.startsWith('l'));

        if (needsUpdate) {
          store.clear();
          const sample = getDefaultSentences();
          for (const s of sample) {
            store.put(s);
          }
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Seed default designated ReVoice staff admin account: Revoicegenai@gmail.com
   * Uses PBKDF2-SHA256 hashed password for 'SJDAR@admin'.
   */
  private async seedDefaultAdminAccount(db: IDBDatabase): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const getAllReq = store.getAll();

      getAllReq.onsuccess = () => {
        const users = (getAllReq.result || []) as User[];
        const targetEmail = 'revoicegenai@gmail.com';
        
        // Find existing admin or legacy admin account
        const existingAdmin = users.find(
          (u) =>
            u.email?.toLowerCase() === targetEmail ||
            u.email?.toLowerCase() === 'admin@revoice.audio' ||
            u.role === 'admin'
        );

        const adminData: User = {
          id: existingAdmin ? existingAdmin.id : 'admin-lead-uuid-0001',
          participantId: existingAdmin?.participantId || 'STAFF_0001',
          name: existingAdmin?.name || 'ReVoice Administrator',
          email: targetEmail,
          role: 'admin',
          cohort: 'healthy',
          gender: 'prefer_not_to_say',
          passwordHash: '290b4331441b613ab1fdb7cbceeea2dd7e822984e4895c9f3c0e5d5262614861',
          passwordSalt: '4a8f92b7c13e5d06a928e4f107b3c85a',
          createdAt: existingAdmin?.createdAt || Date.now(),
          status: 'active',
        };

        // If legacy admin with different id exists, clean up to avoid duplicates
        for (const u of users) {
          if (u.email?.toLowerCase() === 'admin@revoice.audio' && u.id !== adminData.id) {
            store.delete(u.id);
          }
        }

        store.put(adminData);
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Users Operations ---
  async addUser(user: User): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const req = store.add(user);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const db = await this.openDatabase();
    const cleanEmail = email.trim().toLowerCase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const index = store.index('email');
      const req = index.get(cleanEmail);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
        } else {
          // Fallback scan across all users for case insensitivity or whitespace variance
          const allReq = store.getAll();
          allReq.onsuccess = () => {
            const list = (allReq.result || []) as User[];
            const match = list.find(
              (u) => u.email && u.email.trim().toLowerCase() === cleanEmail
            );
            resolve(match || null);
          };
          allReq.onerror = () => resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getUserByMobileNumber(mobileNumber: string): Promise<User | null> {
    const db = await this.openDatabase();
    const cleanDigits = mobileNumber.replace(/\D/g, '').slice(-10);
    if (!cleanDigits) return null;

    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as User[];
        const match = list.find((u) => {
          const uDigits = (u.mobileNumber || '').replace(/\D/g, '').slice(-10);
          if (uDigits && uDigits === cleanDigits) return true;
          if (u.email && u.email.toLowerCase().startsWith(`${cleanDigits}@`)) return true;
          return false;
        });
        resolve(match || null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getUserByParticipantId(participantId: string): Promise<User | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const cleanId = participantId.trim().toUpperCase();
      const index = store.index('participantId');
      const req = index.get(cleanId);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
        } else {
          const allReq = store.getAll();
          allReq.onsuccess = () => {
            const list = (allReq.result || []) as User[];
            const found = list.find((u) => u.participantId && u.participantId.trim().toUpperCase() === cleanId);
            resolve(found || null);
          };
          allReq.onerror = () => resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getUserById(id: string): Promise<User | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllUsers(): Promise<User[]> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllParticipants(): Promise<User[]> {
    const all = await this.getAllUsers();
    return all.filter((u) => u.role !== 'admin');
  }

  async updateUser(user: User): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const req = store.put(user);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Consents Operations ---
  async addConsent(consent: ConsentRecord): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('consents', 'readwrite');
      const store = tx.objectStore('consents');
      const req = store.add(consent);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getLatestConsentForUser(userId: string): Promise<ConsentRecord | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('consents', 'readonly');
      const store = tx.objectStore('consents');
      const index = store.index('userId');
      const req = index.getAll(userId);
      req.onsuccess = () => {
        const records = (req.result || []) as ConsentRecord[];
        if (records.length === 0) {
          resolve(null);
          return;
        }
        records.sort((a, b) => b.timestamp - a.timestamp);
        resolve(records[0]);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- Sentences Operations ---
  async getAllSentences(): Promise<Sentence[]> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sentences', 'readonly');
      const store = tx.objectStore('sentences');
      const req = store.getAll();
      req.onsuccess = () => {
        let list = (req.result || []) as Sentence[];
        if (list.length === 0 || list.some((s) => !s.instructionNotes || s.id.startsWith('l'))) {
          list = getDefaultSentences();
        }
        list.sort((a, b) => {
          if (a.level !== b.level) return a.level - b.level;
          return a.sentenceNumber - b.sentenceNumber;
        });
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getSentencesByLevel(level: number): Promise<Sentence[]> {
    const all = await this.getAllSentences();
    return all.filter((s) => s.level === level);
  }

  async getSentenceById(id: string): Promise<Sentence | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sentences', 'readonly');
      const store = tx.objectStore('sentences');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getSentenceByPromptId(promptId: string): Promise<Sentence | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sentences', 'readonly');
      const store = tx.objectStore('sentences');
      const cleanId = promptId.trim().toUpperCase();
      const directReq = store.get(cleanId);
      directReq.onsuccess = () => {
        if (directReq.result) {
          resolve(directReq.result);
        } else {
          const allReq = store.getAll();
          allReq.onsuccess = () => {
            const list = (allReq.result || []) as Sentence[];
            const found = list.find(
              (s) =>
                (s.promptId && s.promptId.trim().toUpperCase() === cleanId) ||
                (s.id && s.id.trim().toUpperCase() === cleanId)
            );
            resolve(found || null);
          };
          allReq.onerror = () => resolve(null);
        }
      };
      directReq.onerror = () => reject(directReq.error);
    });
  }

  // --- Recordings Metadata Operations ---
  async addRecording(recording: Recording): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('recordings', 'readwrite');
      const store = tx.objectStore('recordings');
      const req = store.put(recording);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async updateRecording(recording: Recording): Promise<void> {
    return this.addRecording(recording);
  }

  async getRecordingsForUser(userId: string): Promise<Recording[]> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('recordings', 'readonly');
      const store = tx.objectStore('recordings');
      const index = store.index('userId');
      const req = index.getAll(userId);
      req.onsuccess = () => {
        const list = (req.result || []) as Recording[];
        list.sort((a, b) => b.timestamp - a.timestamp);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getAllRecordings(): Promise<Recording[]> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('recordings', 'readonly');
      const store = tx.objectStore('recordings');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as Recording[];
        list.sort((a, b) => b.timestamp - a.timestamp);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getRecordingById(id: string): Promise<Recording | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('recordings', 'readonly');
      const store = tx.objectStore('recordings');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getRecordingsForSentence(userId: string, sentenceId: string): Promise<Recording[]> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('recordings', 'readonly');
      const store = tx.objectStore('recordings');
      const index = store.index('user_sentence');
      const req = index.getAll([userId, sentenceId]);
      req.onsuccess = () => {
        const list = (req.result || []) as Recording[];
        list.sort((a, b) => b.timestamp - a.timestamp);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteRecording(id: string): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('recordings', 'readwrite');
      const store = tx.objectStore('recordings');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Binary Audio Files (Simulated Private App Storage) ---
  async saveAudioFile(file: AudioStorageFile): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio_files', 'readwrite');
      const store = tx.objectStore('audio_files');
      const req = store.put(file);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAudioFile(path: string): Promise<AudioStorageFile | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio_files', 'readonly');
      const store = tx.objectStore('audio_files');
      const req = store.get(path);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
        } else {
          // Fallback scan across all audio files to handle normalization or leading slashes
          const allReq = store.getAll();
          allReq.onsuccess = () => {
            const list = (allReq.result || []) as AudioStorageFile[];
            const cleanPath = path.replace(/^\/+/, '').toLowerCase();
            const fileName = cleanPath.split('/').pop() || cleanPath;
            const match = list.find((f) => {
              const fClean = f.path.replace(/^\/+/, '').toLowerCase();
              return (
                fClean === cleanPath ||
                fClean.endsWith(cleanPath) ||
                cleanPath.endsWith(fClean) ||
                (fileName && fClean.endsWith(fileName))
              );
            });
            resolve(match || null);
          };
          allReq.onerror = () => resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteAudioFile(path: string): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio_files', 'readwrite');
      const store = tx.objectStore('audio_files');
      const req = store.delete(path);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAllAudioFiles(): Promise<AudioStorageFile[]> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio_files', 'readonly');
      const store = tx.objectStore('audio_files');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Participant Progress Operations (v3) ---
  async getParticipantProgress(userId: string): Promise<ParticipantProgress | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('participant_progress', 'readonly');
      const store = tx.objectStore('participant_progress');
      const req = store.get(userId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveParticipantProgress(progress: ParticipantProgress): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('participant_progress', 'readwrite');
      const store = tx.objectStore('participant_progress');
      const req = store.put(progress);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Deletion & Withdrawal Requests Operations (v3) ---
  async getDeletionRequests(userId?: string): Promise<DeletionRequest[]> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('deletion_requests', 'readonly');
      const store = tx.objectStore('deletion_requests');
      if (userId) {
        const index = store.index('userId');
        const req = index.getAll(userId);
        req.onsuccess = () => {
          const list = (req.result || []) as DeletionRequest[];
          list.sort((a, b) => b.submissionDate - a.submissionDate);
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      } else {
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (req.result || []) as DeletionRequest[];
          list.sort((a, b) => b.submissionDate - a.submissionDate);
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      }
    });
  }

  async getDeletionRequestById(id: string): Promise<DeletionRequest | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('deletion_requests', 'readonly');
      const store = tx.objectStore('deletion_requests');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async addDeletionRequest(request: DeletionRequest): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('deletion_requests', 'readwrite');
      const store = tx.objectStore('deletion_requests');
      const req = store.put(request);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async updateDeletionRequest(request: DeletionRequest): Promise<void> {
    return this.addDeletionRequest(request);
  }

  // --- Audit Logs Operations (v3) ---
  async addAuditLog(log: AuditLog): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audit_logs', 'readwrite');
      const store = tx.objectStore('audit_logs');
      const req = store.put(log);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audit_logs', 'readonly');
      const store = tx.objectStore('audit_logs');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as AuditLog[];
        list.sort((a, b) => b.timestamp - a.timestamp);
        resolve(list.slice(0, limit));
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- Reviews Operations (v3) ---
  async addReviewRecord(review: ReviewRecord): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reviews', 'readwrite');
      const store = tx.objectStore('reviews');
      const req = store.put(review);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getReviewsForRecording(recordingId: string): Promise<ReviewRecord[]> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reviews', 'readonly');
      const store = tx.objectStore('reviews');
      const index = store.index('recordingId');
      const req = index.getAll(recordingId);
      req.onsuccess = () => {
        const list = (req.result || []) as ReviewRecord[];
        list.sort((a, b) => b.timestamp - a.timestamp);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Complete participant withdrawal / account deletion
   */
  async purgeUserData(userId: string): Promise<void> {
    const recordings = await this.getRecordingsForUser(userId);

    for (const rec of recordings) {
      await this.deleteAudioFile(rec.localFilePath);
      await this.deleteRecording(rec.id);
    }

    const user = await this.getUserById(userId);
    if (user) {
      user.status = 'withdrawn';
      await this.updateUser(user);
    }
  }
}

export const dbService = new DatabaseService();
