import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationFilters,
} from './notification-api';

export const notificationQueryKeys = {
  all: ['notifications'] as const,
  list: (filters: NotificationFilters) => [...notificationQueryKeys.all, 'list', filters] as const,
  unreadCount: () => [...notificationQueryKeys.all, 'unread-count'] as const,
};

export function useNotifications(filters: NotificationFilters) {
  return useQuery(
    queryOptions({
      queryKey: notificationQueryKeys.list(filters),
      queryFn: ({ signal }) => getNotifications(filters, signal),
    }),
  );
}

export function useUnreadNotificationCount(enabled = true) {
  return useQuery(
    queryOptions({
      queryKey: notificationQueryKeys.unreadCount(),
      queryFn: ({ signal }) => getUnreadNotificationCount(signal),
      enabled,
      staleTime: 30_000,
      refetchInterval: enabled ? 60_000 : false,
    }),
  );
}

function useRefreshNotifications() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
  };
}

export function useMarkNotificationRead() {
  const refresh = useRefreshNotifications();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: refresh,
  });
}

export function useMarkAllNotificationsRead() {
  const refresh = useRefreshNotifications();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: refresh,
  });
}
