import { dbService } from './db';
import { recordingRepository } from './recordingRepository';
import { DeletionRequest, DeletionRequestStatus, DeletionRequestType, Recording, User } from '../types';

export class DeletionService {
  /**
   * Submit a new withdrawal or data deletion request
   */
  async submitRequest(
    user: User,
    requestType: DeletionRequestType,
    notes?: string
  ): Promise<DeletionRequest> {
    // Count existing recordings affected
    const recordings = await dbService.getRecordingsForUser(user.id);

    const id = `DEL_REQ_${Date.now().toString().slice(-6)}`;

    const newRequest: DeletionRequest = {
      id,
      userId: user.id,
      participantId: user.participantId,
      requestType,
      submissionDate: Date.now(),
      affectedRecordingsCount: recordings.length,
      assignedStaff: 'Unassigned (Review Queue)',
      status: 'Submitted',
      notes,
      actionHistory: [
        {
          status: 'Submitted',
          updatedBy: user.participantId,
          timestamp: Date.now(),
          comment: 'Request submitted by participant via profile portal.',
        },
      ],
    };

    await dbService.addDeletionRequest(newRequest);

    // Audit log
    await dbService.addAuditLog({
      id: crypto.randomUUID(),
      action: 'DELETION_REQUEST_SUBMITTED',
      performedBy: user.participantId,
      details: `${requestType} request filed: ${id} (${recordings.length} recordings affected)`,
      timestamp: Date.now(),
      targetId: id,
    });

    return newRequest;
  }

  /**
   * Submit a deletion request for a specific single submitted audio take
   * Participants cannot delete submitted audio directly; they file a request to admin.
   */
  async submitRecordingDeletionRequest(
    user: User,
    recording: Recording,
    reason?: string
  ): Promise<DeletionRequest> {
    const id = `DEL_REC_${Date.now().toString().slice(-6)}`;
    const recId = recording.recordingId || recording.id;
    const promptId = recording.promptId || recording.sentenceId;

    const newRequest: DeletionRequest = {
      id,
      userId: user.id,
      participantId: user.participantId,
      requestType: 'data_deletion_only',
      targetRecordingId: recId,
      targetPromptId: promptId,
      submissionDate: Date.now(),
      affectedRecordingsCount: 1,
      assignedStaff: 'Unassigned (Admin Review Queue)',
      status: 'Submitted',
      notes: `Participant requested deletion of submitted audio take: ${recId} (Prompt: ${promptId}). Reason: ${reason || 'Not specified'}.`,
      actionHistory: [
        {
          status: 'Submitted',
          updatedBy: user.participantId,
          timestamp: Date.now(),
          comment: `Single audio take deletion request filed for ${recId}.`,
        },
      ],
    };

    await dbService.addDeletionRequest(newRequest);

    // Audit log
    await dbService.addAuditLog({
      id: crypto.randomUUID(),
      action: 'RECORDING_DELETION_REQUESTED',
      performedBy: user.participantId,
      details: `Participant requested admin to delete audio take ${recId} (${promptId})`,
      timestamp: Date.now(),
      targetId: id,
    });

    return newRequest;
  }

  /**
   * Get requests for a participant or all for Admin
   */
  async getRequests(userId?: string): Promise<DeletionRequest[]> {
    return await dbService.getDeletionRequests(userId);
  }

  /**
   * Update request status & process data purge if completed by Admin
   */
  async updateStatus(
    requestId: string,
    newStatus: DeletionRequestStatus,
    staffEmail: string,
    comment?: string
  ): Promise<DeletionRequest> {
    const req = await dbService.getDeletionRequestById(requestId);
    if (!req) throw new Error('Deletion request not found.');

    req.status = newStatus;
    req.assignedStaff = staffEmail;

    if (!req.actionHistory) {
      req.actionHistory = [];
    }

    req.actionHistory.push({
      status: newStatus,
      updatedBy: staffEmail,
      timestamp: Date.now(),
      comment,
    });

    // If completed by Admin, execute confirmed data purge
    if (newStatus === 'Completed') {
      req.completionDate = Date.now();
      if (req.targetRecordingId) {
        // Delete only the requested audio take
        await recordingRepository.deleteRecording(req.targetRecordingId, req.userId);
      } else {
        // Full user data purge for withdrawal
        await dbService.purgeUserData(req.userId);
      }
    }

    await dbService.updateDeletionRequest(req);

    // Log in audit trail
    await dbService.addAuditLog({
      id: crypto.randomUUID(),
      action: 'DELETION_REQUEST_UPDATED',
      performedBy: staffEmail,
      details: `Request ${requestId} status updated to ${newStatus}${comment ? ` - ${comment}` : ''}`,
      timestamp: Date.now(),
      targetId: requestId,
    });

    return req;
  }
}

export const deletionService = new DeletionService();
