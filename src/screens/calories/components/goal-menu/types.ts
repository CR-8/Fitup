export interface GoalMenuProps {
    color: string;
    labels: { button: string; today: string; daily: string };
    onAdjustToday: () => void;
    onChangeDaily: () => void;
}
