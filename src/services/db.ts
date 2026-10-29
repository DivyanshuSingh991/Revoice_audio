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
import { supabaseDbService } from './supabaseDbService';
import { isSupabaseConfigured } from './supabaseClient';

const DB_NAME = 'ReVoiceAudioSpeechCorpusDB';
const DB_VERSION = 3;

/**
 * Hybrid Database Service:
 * - When Supabase is configured: Writes and reads directly from Supabase PostgreSQL Cloud DB.
 * - Always caches in browser IndexedDB (Local Cache & Offline Fallback).
 * - Real audio binaries (WAV blobs) ALWAYS remain safely in local IndexedDB 'audio_files' store.
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

        // 3. Sentences Store
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

        // 5. Audio Files Binary Blob Store (Local Browser Disk)
        if (!db.objectStoreNames.contains('audio_files')) {
          db.createObjectStore('audio_files', { keyPath: 'path' });
        }

        // 6. Participant Progress Store
        if (!db.objectStoreNames.contains('participant_progress')) {
          db.createObjectStore('participant_progress', { keyPath: 'userId' });
        }

        // 7. Deletion Requests Store
        if (!db.objectStoreNames.contains('deletion_requests')) {
          const delStore = db.createObjectStore('deletion_requests', { keyPath: 'id' });
          delStore.createIndex('userId', 'userId', { unique: false });
          delStore.createIndex('status', 'status', { unique: false });
          delStore.createIndex('submissionDate', 'submissionDate', { unique: false });
        }

        // 8. Audit Logs Store
        if (!db.objectStoreNames.contains('audit_logs')) {
          const logStore = db.createObjectStore('audit_logs', { keyPath: 'id' });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 9. Reviews Store
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

  private async cacheLocalUser(user: User): Promise<void> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction('users', 'readwrite');
      tx.objectStore('users').put(user);
    } catch {
      // Ignore background cache failure
    }
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
          existing.some((s) => !s.instructionNotes || s.id.startsWith('l'));

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

  private async seedDefaultAdminAccount(db: IDBDatabase): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const getAllReq = store.getAll();

      getAllReq.onsuccess = () => {
        const users = (getAllReq.result || []) as User[];
        const targetEmail = 'revoicegenai@gmail.com';

        const existingAdmin = users.find(
          (u) =>
            u.email?.toLowerCase() === targetEmail ||
            u.email?.toLowerCase() === 'admin@revoice.audio' ||
            u.role === 'admin'
        );

        const adminData: User = {
          id: existingAdmin ? existingAdmin.id : 'a0000000-0000-0000-0000-000000000001',
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
    if (isSupabaseConfigured) {
      await supabaseDbService.addUser(user);
    }
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const req = store.put(user);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (isSupabaseConfigured) {
      try {
        const user = await supabaseDbService.getUserByEmail(cleanEmail);
        if (user) {
          this.cacheLocalUser(user);
          return user;
        }
      } catch (e) {
        console.warn('Supabase getUserByEmail failed, falling back to local DB:', e);
      }
    }

    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const index = store.index('email');
      const req = index.get(cleanEmail);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
        } else {
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
    const cleanDigits = mobileNumber.replace(/\D/g, '').slice(-10);
    if (!cleanDigits) return null;

    if (isSupabaseConfigured) {
      try {
        const user = await supabaseDbService.getUserByMobileNumber(cleanDigits);
        if (user) {
          this.cacheLocalUser(user);
          return user;
        }
      } catch (e) {
        console.warn('Supabase getUserByMobileNumber failed, falling back to local DB:', e);
      }
    }

    const db = await this.openDatabase();
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
    const cleanId = participantId.trim().toUpperCase();

    if (isSupabaseConfigured) {
      try {
        const user = await supabaseDbService.getUserByParticipantId(cleanId);
        if (user) {
          this.cacheLocalUser(user);
          return user;
        }
      } catch (e) {
        console.warn('Supabase getUserByParticipantId failed, falling back to local DB:', e);
      }
    }

    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
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
    if (isSupabaseConfigured) {
      try {
        const user = await supabaseDbService.getUserById(id);
        if (user) {
          this.cacheLocalUser(user);
          return user;
        }
      } catch (e) {
        console.warn('Supabase getUserById failed, falling back to local DB:', e);
      }
    }

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
    if (isSupabaseConfigured) {
      try {
        const users = await supabaseDbService.getAllUsers();
        if (users && users.length > 0) return users;
      } catch (e) {
        console.warn('Supabase getAllUsers failed, falling back to local DB:', e);
      }
    }

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
    if (isSupabaseConfigured) {
      try {
        const parts = await supabaseDbService.getAllParticipants();
        if (parts && parts.length > 0) return parts;
      } catch (e) {
        console.warn('Supabase getAllParticipants failed, falling back to local DB:', e);
      }
    }
    const all = await this.getAllUsers();
    return all.filter((u) => u.role !== 'admin');
  }

  async updateUser(user: User): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabaseDbService.updateUser(user);
      } catch (e) {
        console.error('Supabase updateUser error:', e);
      }
    }
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
    if (isSupabaseConfigured) {
      try {
        await supabaseDbService.addConsent(consent);
      } catch (e) {
        console.error('Supabase addConsent error:', e);
      }
    }
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('consents', 'readwrite');
      const store = tx.objectStore('consents');
      const req = store.put(consent);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getLatestConsentForUser(userId: string): Promise<ConsentRecord | null> {
    if (isSupabaseConfigured) {
      try {
        const consent = await supabaseDbService.getLatestConsentForUser(userId);
        if (consent) return consent;
      } catch (e) {
        console.warn('Supabase getLatestConsentForUser failed, falling back to local DB:', e);
      }
    }

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
    if (isSupabaseConfigured) {
      try {
        const sentences = await supabaseDbService.getAllSentences();
        if (sentences && sentences.length > 0) return sentences;
      } catch (e) {
        console.warn('Supabase getAllSentences failed, falling back to local DB:', e);
      }
    }

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
    if (isSupabaseConfigured) {
      try {
        const s = await supabaseDbService.getSentenceById(id);
        if (s) return s;
      } catch (e) {
        console.warn('Supabase getSentenceById failed, falling back to local DB:', e);
      }
    }

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
    if (isSupabaseConfigured) {
      try {
        const s = await supabaseDbService.getSentenceByPromptId(promptId);
        if (s) return s;
      } catch (e) {
        console.warn('Supabase getSentenceByPromptId failed, falling back to local DB:', e);
      }
    }

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
    if (isSupabaseConfigured) {
      try {
        await supabaseDbService.addRecording(recording);
      } catch (e) {
        console.error('Supabase addRecording error:', e);
      }
    }

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
    if (isSupabaseConfigured) {
      try {
        const recs = await supabaseDbService.getRecordingsForUser(userId);
        if (recs) return recs;
      } catch (e) {
        console.warn('Supabase getRecordingsForUser failed, falling back to local DB:', e);
      }
    }

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
    if (isSupabaseConfigured) {
      try {
        const recs = await supabaseDbService.getAllRecordings();
        if (recs) return recs;
      } catch (e) {
        console.warn('Supabase getAllRecordings failed, falling back to local DB:', e);
      }
    }

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
    if (isSupabaseConfigured) {
      try {
        const rec = await supabaseDbService.getRecordingById(id);
        if (rec) return rec;
      } catch (e) {
        console.warn('Supabase getRecordingById failed, falling back to local DB:', e);
      }
    }

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
    if (isSupabaseConfigured) {
      try {
        const recs = await supabaseDbService.getRecordingsForSentence(userId, sentenceId);
        if (recs) return recs;
      } catch (e) {
        console.warn('Supabase getRecordingsForSentence failed, falling back to local DB:', e);
      }
    }

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
    if (isSupabaseConfigured) {
      try {
        await supabaseDbService.deleteRecording(id);
      } catch (e) {
        console.error('Supabase deleteRecording error:', e);
      }
    }

    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('recordings', 'readwrite');
      const store = tx.objectStore('recordings');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Binary Audio Files (ALWAYS in Local Browser IndexedDB) ---
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

  // --- Participant Progress Operations ---
  async getParticipantProgress(userId: string): Promise<ParticipantProgress | null> {
    if (isSupabaseConfigured) {
      try {
        const prog = await supabaseDbService.getParticipantProgress(userId);
        if (prog) return prog;
      } catch (e) {
        console.warn('Supabase getParticipantProgress failed, falling back to local DB:', e);
      }
    }

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
    if (isSupabaseConfigured) {
      try {
        await supabaseDbService.saveParticipantProgress(progress);
      } catch (e) {
        console.error('Supabase saveParticipantProgress error:', e);
      }
    }

    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('participant_progress', 'readwrite');
      const store = tx.objectStore('participant_progress');
      const req = store.put(progress);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Deletion & Withdrawal Requests Operations ---
  async getDeletionRequests(userId?: string): Promise<DeletionRequest[]> {
    if (isSupabaseConfigured) {
      try {
        const reqs = await supabaseDbService.getDeletionRequests(userId);
        if (reqs) return reqs;
      } catch (e) {
        console.warn('Supabase getDeletionRequests failed, falling back to local DB:', e);
      }
    }

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
    if (isSupabaseConfigured) {
      try {
        const req = await supabaseDbService.getDeletionRequestById(id);
        if (req) return req;
      } catch (e) {
        console.warn('Supabase getDeletionRequestById failed, falling back to local DB:', e);
      }
    }

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
    if (isSupabaseConfigured) {
      try {
        await supabaseDbService.addDeletionRequest(request);
      } catch (e) {
        console.error('Supabase addDeletionRequest error:', e);
      }
    }

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

  // --- Audit Logs Operations ---
  async addAuditLog(log: AuditLog): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabaseDbService.addAuditLog(log);
      } catch (e) {
        console.error('Supabase addAuditLog error:', e);
      }
    }

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
    if (isSupabaseConfigured) {
      try {
        const logs = await supabaseDbService.getAuditLogs(limit);
        if (logs && logs.length > 0) return logs;
      } catch (e) {
        console.warn('Supabase getAuditLogs failed, falling back to local DB:', e);
      }
    }

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

  // --- Reviews Operations ---
  async addReviewRecord(review: ReviewRecord): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabaseDbService.addReviewRecord(review);
      } catch (e) {
        console.error('Supabase addReviewRecord error:', e);
      }
    }

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
    if (isSupabaseConfigured) {
      try {
        const revs = await supabaseDbService.getReviewsForRecording(recordingId);
        if (revs && revs.length > 0) return revs;
      } catch (e) {
        console.warn('Supabase getReviewsForRecording failed, falling back to local DB:', e);
      }
    }

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
