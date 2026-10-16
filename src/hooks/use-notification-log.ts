import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
    countUnreadNotifications,
    getNotifications,
    markNotificationsRead,
} from '@/crud/notification-log';

import { useUser } from './use-user';

const KEY = 'notification-log';

export const useNotificationLog = () => {
    const { user } = useUser();
    const queryClient = useQueryClient();

    const { data = [] } = useQuery({
        queryKey: [KEY, user?.id, 'list'],
        queryFn: () => getNotifications(user!.id),
        enabled: !!user?.id,
    });

    const userId = user?.id;
    const markRead = useCallback(async () => {
        if (!userId) return;

        await markNotificationsRead(userId);
        queryClient.invalidateQueries({ queryKey: [KEY] });
    }, [queryClient, userId]);

    return { notifications: data, markRead };
};

/** For the bell's dot on Today. */
export const useUnreadNotifications = (): number => {
    const { user } = useUser();

    const { data = 0 } = useQuery({
        queryKey: [KEY, user?.id, 'unread'],
        queryFn: () => countUnreadNotifications(user!.id),
        enabled: !!user?.id,
    });

    return data;
};
