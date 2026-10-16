/**
 * No navigation bar: Today draws its own header (greeting, name, date). Settings
 * is the You tab, so nothing is left to put in a bar.
 */
const useHomeTab = () => ({
    name: 'index',
    options: { headerShown: false },
});

export { useHomeTab };
