import { storage } from '@/storage';

const KEY = 'welcome.seen';

/** Whether the Welcome screen has been shown (and left) on this install. */
export const hasSeenWelcome = (): boolean => storage.getBoolean(KEY) === true;

export const markWelcomeSeen = (): void => storage.set(KEY, true);
