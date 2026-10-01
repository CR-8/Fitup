import { FC } from 'react';
import { ScrollView as DefaultScrollView } from 'react-native';

export type ScrollViewProps = DefaultScrollView['props'];

/** Lets the native header, large title and tab bar inset the content. */
export const ScrollView: FC<ScrollViewProps> = ({ ...rest }) => {
    return <DefaultScrollView contentInsetAdjustmentBehavior="automatic" {...rest} />;
};
