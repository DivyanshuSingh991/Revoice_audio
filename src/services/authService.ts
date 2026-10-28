import { dbService } from './db';
import { User, Gender, ConsentRecord, ConsentStatus, UserRole, Cohort } from '../types';

export const CURRENT_CONSENT_VERSION = 'v1.2-2026';

/**
 * Converts ArrayBuffer to Hex String
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  let hexString = '';
  for (let i = 0; i < byteArray.byteLength; i++) {
    hexString += byteArray[i].toString(16).padStart(2, '0');
  }
  return hexString;
}

/**
 * Converts Hex String to Uint8Array
 */
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * PBKDF2-SHA256 Cryptographic Password Hasher
 * Uses Web Crypto API; never stores plaintext passwords.
 */
export async function hashPassword(password: string, existingSaltHex?: string): Promise<{ hash: string; salt: string }> {
  const encoder = new TextEncoder();
  const salt = existingSaltHex
    ? hexToBuffer(existingSaltHex)
    : window.crypto.getRandomValues(new Uint8Array(16));

  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: (salt as Uint8Array).buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exported = await window.crypto.subtle.exportKey('raw', derivedKey);
  const hashHex = bufferToHex(exported);
  const saltHex = bufferToHex((salt as Uint8Array).buffer as ArrayBuffer);

  return { hash: hashHex, salt: saltHex };
}

/**
 * Verifies a candidate password against stored hash & salt
 */
export async function verifyPassword(candidate: string, storedHash: string, saltHex: string): Promise<boolean> {
  const { hash } = await hashPassword(candidate, saltHex);
  return hash === storedHash;
}

/**
 * Generate sequential Speaker / Participant ID: SPK_0001, SPK_0002, SPK_0003, SPK_0004...
 * Strictly matches the four-digit zero-padded SPK_XXXX format.
 */
export async function generateUniqueParticipantId(): Promise<string> {
  const allUsers = await dbService.getAllUsers();
  const existingIds = new Set(allUsers.map((u) => (u.participantId || '').trim().toUpperCase()));

  let maxSeq = 0;
  for (const user of allUsers) {
    if (!user.participantId) continue;
    const match = user.participantId.trim().match(/^SPK_(\d+)$/i);
    if (match) {
      const val = parseInt(match[1], 10);
      if (!isNaN(val) && val > maxSeq) {
        maxSeq = val;
      }
    }
  }

  let candidateNum = maxSeq + 1;
  while (true) {
    const candidate = `SPK_${candidateNum.toString().padStart(4, '0')}`;
    if (!existingIds.has(candidate.toUpperCase())) {
      return candidate;
    }
    candidateNum++;
  }
}

export interface RegisterParams {
  name: string;
  email: string;
  mobileNumber: string;
  gender: Gender;
  age?: number;
  cohort?: Cohort;
  role?: UserRole;
  password: string;
  consentAgreed?: boolean;
}

class AuthService {
  private currentUser: User | null = null;
  private currentConsent: ConsentRecord | null = null;

  /**
   * Initializes session from sessionStorage if available
   */
  async initSession(): Promise<User | null> {
    const savedUserId =
      sessionStorage.getItem('revoice_audio_active_user_id') ||
      sessionStorage.getItem('resonavoice_active_user_id');

    if (savedUserId) {
      const user = await dbService.getUserById(savedUserId);
      if (user && user.status === 'active') {
        this.currentUser = user;
        this.currentConsent = await dbService.getLatestConsentForUser(user.id);
        return user;
      } else {
        sessionStorage.removeItem('revoice_audio_active_user_id');
        sessionStorage.removeItem('resonavoice_active_user_id');
      }
    }
    return null;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  getCurrentConsent(): ConsentRecord | null {
    return this.currentConsent;
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  hasValidConsent(): boolean {
    return (
      this.currentConsent !== null &&
      this.currentConsent.consentStatus === 'accepted' &&
      this.currentConsent.consentVersion === CURRENT_CONSENT_VERSION
    );
  }

  /**
   * Register a new participant or staff account
   */
  async register(params: RegisterParams): Promise<User> {
    const cleanMobile = (params.mobileNumber || '').replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }

    const emailToUse = (params.email || '').trim().toLowerCase();
    if (!emailToUse || !emailToUse.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    // Check duplicate email
    const existingEmail = await dbService.getUserByEmail(emailToUse);
    if (existingEmail) {
      throw new Error('An account with this email address is already registered. Please sign in instead.');
    }

    // Check duplicate mobile
    const existingMobile = await dbService.getUserByMobileNumber(cleanMobile);
    if (existingMobile) {
      throw new Error('An account with this mobile number is already registered.');
    }

    // Generate unique participant ID or staff ID
    const role: UserRole = params.role || 'participant';
    const cohort: Cohort = params.cohort || 'healthy';
    const participantId =
      role === 'admin'
        ? `STAFF_${Date.now().toString().slice(-4)}`
        : await generateUniqueParticipantId();

    // Hash password with salt using PBKDF2
    const { hash, salt } = await hashPassword(params.password);

    const newUser: User = {
      id: crypto.randomUUID(),
      participantId,
      name: params.name.trim(),
      email: emailToUse,
      mobileNumber: cleanMobile,
      role,
      cohort,
      gender: params.gender,
      age: params.age,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: Date.now(),
      status: 'active',
    };

    await dbService.addUser(newUser);

    // Set current user
    this.currentUser = newUser;
    sessionStorage.setItem('revoice_audio_active_user_id', newUser.id);

    // Initialize participant progress
    if (role === 'participant') {
      await dbService.saveParticipantProgress({
        userId: newUser.id,
        cohort: newUser.cohort,
        targetPerLevel: 1, // Target: 1 from each level = 3 total target
        currentPromptIndex: { 1: 1, 2: 1, 3: 1 }, // Start at S01 for level 1, 2, 3
        completedPrompts: [],
        lastUpdated: Date.now(),
      });
    }

    // Log registration in audit log
    await dbService.addAuditLog({
      id: crypto.randomUUID(),
      action: 'USER_REGISTERED',
      performedBy: newUser.participantId,
      details: `New ${role} account created for ${newUser.email} (Cohort: ${cohort})`,
      timestamp: Date.now(),
      targetId: newUser.id,
    });

    // If consent agreed during registration, record it immediately
    if (params.consentAgreed) {
      await this.recordConsent(
        newUser.id,
        [
          'voice_collection_purpose_accepted',
          'local_audio_storage_acknowledged',
          'ai_training_research_permitted',
          'data_retention_and_deletion_rights_understood',
        ],
        'accepted'
      );
    }

    return newUser;
  }

  /**
   * Record informed consent agreement
   */
  async recordConsent(userId: string, agreedTerms: string[], status: ConsentStatus): Promise<ConsentRecord> {
    const consentRecord: ConsentRecord = {
      id: crypto.randomUUID(),
      userId,
      consentVersion: CURRENT_CONSENT_VERSION,
      consentStatus: status,
      agreedTerms,
      timestamp: Date.now(),
    };

    await dbService.addConsent(consentRecord);
    if (this.currentUser && this.currentUser.id === userId) {
      this.currentConsent = consentRecord;
    }

    return consentRecord;
  }

  /**
   * Login with email (or mobile number / Participant ID) and password
   */
  async login(loginIdentifier: string, password: string, requiredRole?: UserRole): Promise<User> {
    const trimmed = loginIdentifier.trim();
    const upper = trimmed.toUpperCase();
    const cleanDigits = trimmed.replace(/\D/g, '').slice(-10);
    let user: User | null = null;

    // 1. Check by Email
    if (trimmed.includes('@')) {
      user = await dbService.getUserByEmail(trimmed.toLowerCase());
    }

    // 2. Check by Participant ID / Staff ID (e.g. SPK_0001, STAFF_0001)
    if (!user && (upper.startsWith('SPK_') || upper.startsWith('STAFF_') || upper.startsWith('RV-'))) {
      user = await dbService.getUserByParticipantId(upper);
    }

    // 3. Fallback: 10-digit mobile number
    if (!user && cleanDigits.length === 10) {
      user = await dbService.getUserByMobileNumber(cleanDigits);
    }

    // 4. Fallbacks for any remaining format
    if (!user) {
      user = await dbService.getUserByEmail(trimmed.toLowerCase());
    }
    if (!user) {
      user = await dbService.getUserByParticipantId(upper);
    }
    if (!user && cleanDigits.length >= 7) {
      user = await dbService.getUserByMobileNumber(cleanDigits);
    }

    if (!user) {
      throw new Error('No registered account found with that email or credentials.');
    }

    if (user.status === 'withdrawn') {
      throw new Error('This account has been withdrawn or deactivated.');
    }

    // Check password against PBKDF2 hash, with direct support for seeded admin credentials
    let isValid = false;
    const isTargetAdmin =
      user.email?.toLowerCase() === 'revoicegenai@gmail.com' ||
      user.email?.toLowerCase() === 'admin@revoice.audio';

    if (isTargetAdmin && password === 'SJDAR@admin') {
      isValid = true;
      if (user.email !== 'revoicegenai@gmail.com') {
        user.email = 'revoicegenai@gmail.com';
        await dbService.updateUser(user);
      }
    } else {
      isValid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
    }

    if (!isValid) {
      throw new Error('Incorrect password. Please verify your credentials.');
    }

    // Role verification
    if (requiredRole && user.role !== requiredRole) {
      if (requiredRole === 'admin') {
        throw new Error('Access Denied: This account is not an authorized administrator.');
      } else {
        throw new Error('Access Denied: Please use the Staff / Admin sign-in portal.');
      }
    }

    this.currentUser = user;
    this.currentConsent = await dbService.getLatestConsentForUser(user.id);
    sessionStorage.setItem('revoice_audio_active_user_id', user.id);

    // Audit log
    await dbService.addAuditLog({
      id: crypto.randomUUID(),
      action: 'USER_LOGIN',
      performedBy: user.participantId,
      details: `${user.role.toUpperCase()} session authenticated (${user.email})`,
      timestamp: Date.now(),
      targetId: user.id,
    });

    return user;
  }

  /**
   * Change user password
   */
  async changePassword(currentPass: string, newPass: string): Promise<void> {
    if (!this.currentUser) throw new Error('Not authenticated.');

    const isValid = await verifyPassword(currentPass, this.currentUser.passwordHash, this.currentUser.passwordSalt);
    if (!isValid) {
      throw new Error('Current password is not correct.');
    }

    const { hash, salt } = await hashPassword(newPass);
    this.currentUser.passwordHash = hash;
    this.currentUser.passwordSalt = salt;
    await dbService.updateUser(this.currentUser);
  }

  /**
   * Reset / Recover Password by email
   */
  async resetPassword(email: string, newPass: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const user = await dbService.getUserByEmail(normalized);
    if (!user) {
      throw new Error('No account found matching that email.');
    }
    const { hash, salt } = await hashPassword(newPass);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    await dbService.updateUser(user);
  }

  /**
   * Reset / Recover Password by registered mobile number
   */
  async resetPasswordWithMobile(mobileNumber: string, newPass: string): Promise<void> {
    const cleanDigits = mobileNumber.replace(/\D/g, '').slice(-10);
    const user = await dbService.getUserByMobileNumber(cleanDigits);
    if (!user) {
      throw new Error('No account found with this mobile number.');
    }
    const { hash, salt } = await hashPassword(newPass);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    await dbService.updateUser(user);
  }

  /**
   * Log out active user
   */
  logout(): void {
    this.currentUser = null;
    this.currentConsent = null;
    sessionStorage.removeItem('revoice_audio_active_user_id');
    sessionStorage.removeItem('resonavoice_active_user_id');
  }

  /**
   * Withdraw consent & purge recordings
   */
  async withdrawConsentAndPurge(): Promise<void> {
    if (!this.currentUser) throw new Error('Not authenticated.');

    await this.recordConsent(this.currentUser.id, ['consent_withdrawn'], 'withdrawn');
    await dbService.purgeUserData(this.currentUser.id);
    this.logout();
  }
}

export const authService = new AuthService();
