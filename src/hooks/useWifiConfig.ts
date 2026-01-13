import { useState, useEffect, useCallback } from 'react';
import { AllowedWifi } from '../../types';
import {
    getAllowedWifis,
    getActiveWifis,
    createWifi,
    updateWifi,
    deleteWifi,
} from '../services/wifiConfigService';

export const useWifiConfig = (activeOnly = false) => {
    const [wifis, setWifis] = useState<AllowedWifi[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchWifis = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = activeOnly ? await getActiveWifis() : await getAllowedWifis();
            setWifis(data);
        } catch (err) {
            console.error('Error fetching WiFi configs:', err);
            setError('Không thể tải danh sách WiFi');
        } finally {
            setLoading(false);
        }
    }, [activeOnly]);

    useEffect(() => {
        fetchWifis();
    }, [fetchWifis]);

    const create = async (data: Omit<AllowedWifi, 'id' | 'createdAt'>): Promise<string> => {
        const id = await createWifi({
            ...data,
            createdAt: new Date().toISOString(),
        });
        await fetchWifis();
        return id;
    };

    const update = async (id: string, data: Partial<AllowedWifi>): Promise<void> => {
        await updateWifi(id, data);
        await fetchWifis();
    };

    const remove = async (id: string): Promise<void> => {
        await deleteWifi(id);
        await fetchWifis();
    };

    const toggleActive = async (id: string, isActive: boolean): Promise<void> => {
        await updateWifi(id, { isActive });
        await fetchWifis();
    };

    return {
        wifis,
        loading,
        error,
        createWifi: create,
        updateWifi: update,
        deleteWifi: remove,
        toggleActive,
        refresh: fetchWifis,
    };
};
