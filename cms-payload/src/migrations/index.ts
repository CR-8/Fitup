import * as migration_20260923_163041_initial from './20260923_163041_initial';
import * as migration_20261017_105850_awards from './20261017_105850_awards';

export const migrations = [
  {
    up: migration_20260923_163041_initial.up,
    down: migration_20260923_163041_initial.down,
    name: '20260923_163041_initial',
  },
  {
    up: migration_20261017_105850_awards.up,
    down: migration_20261017_105850_awards.down,
    name: '20261017_105850_awards'
  },
];
