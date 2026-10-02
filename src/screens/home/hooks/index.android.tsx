/**
 * No navigation header. It only ever held a create button, and starting a
 * workout lives on the Workout tab — an empty header was a band of blank space
 * above the greeting.
 */
const useHomeTab = () => ({
    name: 'index',
    options: { headerShown: false },
});

export { useHomeTab };
