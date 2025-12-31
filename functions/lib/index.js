"use strict";
/**
 * Firebase Cloud Functions for EduManager Pro
 *
 * These functions handle:
 * 1. Data integrity - Cascade updates when class/student data changes
 * 2. Auto-generation - Create sessions when class is created
 * 3. Data cleanup - Handle deletions properly
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin
admin.initializeApp();
// Export all triggers
__exportStar(require("./triggers/classTriggers"), exports);
__exportStar(require("./triggers/studentTriggers"), exports);
__exportStar(require("./triggers/sessionTriggers"), exports);
__exportStar(require("./triggers/holidayTriggers"), exports);
__exportStar(require("./triggers/homeworkTriggers"), exports);
__exportStar(require("./triggers/attendanceTriggers"), exports);
__exportStar(require("./triggers/studentAttendanceTriggers"), exports);
__exportStar(require("./triggers/contractTriggers"), exports);
__exportStar(require("./triggers/staffTriggers"), exports);
__exportStar(require("./triggers/salaryTriggers"), exports);
//# sourceMappingURL=index.js.map