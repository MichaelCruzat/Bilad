// The bilad theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in bilad.settings.json and the generated bilad.settings.ts;
// change them with `astryx experimental theme editor set bilad ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {biladSettings} from './bilad.settings';

export const biladTheme = defineTheme({
  extends: biladSettings,
  name: 'bilad',
});
