import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Upload a check-in photo to Firebase Storage
 * @param staffId - Staff ID
 * @param photoBlob - Photo blob from camera capture
 * @param type - 'checkin' or 'checkout'
 * @returns Download URL of uploaded photo
 */
export const uploadCheckInPhoto = async (
    staffId: string,
    photoBlob: Blob,
    type: 'checkin' | 'checkout'
): Promise<string> => {
    const timestamp = Date.now();
    const date = new Date().toISOString().split('T')[0];
    const fileName = `${date}_${type}_${timestamp}.jpg`;
    const storagePath = `checkin-photos/${staffId}/${fileName}`;

    const storageRef = ref(storage, storagePath);

    // Upload the blob
    await uploadBytes(storageRef, photoBlob, {
        contentType: 'image/jpeg',
    });

    // Get download URL
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
};

/**
 * Convert base64 data URL to Blob
 */
export const dataURLtoBlob = (dataUrl: string): Blob => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};
