import { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { toDateKey } from '@/crud/nutrition';
import { useTodayKey } from '@/hooks/use-water';
import { RingCalendar, calendarMonths } from '@/screens/calories/calendar';
import { Rings } from '@/screens/home/components/charts';
import { ACCENT, useActivityDays } from '@/screens/home/summary';

import { useActivityStore } from '.';

/** Every day's three rings, a month at a time; picking a day shows it on the activity screen. */
const ActivityCalendarScreen: FC = () => {
    const { t } = useTranslation(['screens']);
    const today = useTodayKey();
    const day = useActivityStore((state) => state.day) || today;
    const setDay = useActivityStore((state) => state.setDay);
    const months = calendarMonths(today);
    const { dayFor } = useActivityDays(
        toDateKey(months[0].toDate()),
        toDateKey(months[months.length - 1].endOf('month').toDate()),
    );

    return (
        <RingCalendar
            title={t('activity.calendar', { ns: 'screens' })}
            months={months}
            selected={day}
            color={ACCENT.distance}
            onPick={setDay}
            ring={(date) => <Rings rings={dayFor(date).rings} size={34} />}
        />
    );
};

export default ActivityCalendarScreen;
