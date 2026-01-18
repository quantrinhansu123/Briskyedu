"use strict";
/**
 * Session Collection Triggers
 *
 * Handles:
 * - Update class progress when session status changes
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onSessionDelete = exports.onSessionCreate = exports.onSessionUpdate = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
const REGION = 'asia-southeast1';
/**
 * Trigger: When a session is updated
 * Actions:
 * - Update class progress when session marked as completed
 */
exports.onSessionUpdate = functions
    .region(REGION)
    .firestore
    .document('classSessions/{sessionId}')
    .onUpdate(async (change, context) => {
    const sessionId = context.params.sessionId;
    const before = change.before.data();
    const after = change.after.data();
    // Only process if status changed
    if (before.status === after.status) {
        return null;
    }
    console.log(`[onSessionUpdate] Session ${sessionId} status: "${before.status}" → "${after.status}"`);
    // Update class progress
    await updateClassProgress(after.classId);
    return null;
});
/**
 * Trigger: When a session is created
 * (Usually by onClassCreate, but could be manual)
 */
exports.onSessionCreate = functions
    .region(REGION)
    .firestore
    .document('classSessions/{sessionId}')
    .onCreate(async (snap, context) => {
    const sessionData = snap.data();
    console.log(`[onSessionCreate] Session created for class ${sessionData.classId}`);
    // Update class progress
    await updateClassProgress(sessionData.classId);
    return null;
});
/**
 * Trigger: When a session is deleted
 */
exports.onSessionDelete = functions
    .region(REGION)
    .firestore
    .document('classSessions/{sessionId}')
    .onDelete(async (snap, context) => {
    const sessionData = snap.data();
    console.log(`[onSessionDelete] Session deleted from class ${sessionData.classId}`);
    // Update class progress
    await updateClassProgress(sessionData.classId);
    return null;
});
/**
 * Helper: Update class progress based on sessions
 */
async function updateClassProgress(classId) {
    const sessionsSnapshot = await db
        .collection('classSessions')
        .where('classId', '==', classId)
        .get();
    const total = sessionsSnapshot.size;
    let completed = 0;
    sessionsSnapshot.forEach(doc => {
        const session = doc.data();
        if (session.status === 'Đã học') {
            completed++;
        }
    });
    const progress = `${completed}/${total}`;
    await db.collection('classes').doc(classId).update({
        completedSessions: completed,
        progress,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`[updateClassProgress] Class ${classId} progress: ${progress}`);
}
//# sourceMappingURL=sessionTriggers.js.map