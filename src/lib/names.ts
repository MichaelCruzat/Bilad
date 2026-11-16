/** Natural Earth's short names, spelled out so no reader meets an abbreviation. */
export const FULL_NAMES: Record<string, string> = {
  'Marshall Is.': 'Marshall Islands',
  'N. Mariana Is.': 'Northern Mariana Islands',
  'U.S. Virgin Is.': 'US Virgin Islands',
  'S. Geo. and the Is.': 'South Georgia and the South Sandwich Islands',
  'Br. Indian Ocean Ter.': 'British Indian Ocean Territory',
  'Pitcairn Is.': 'Pitcairn Islands',
  'Falkland Is.': 'Falkland Islands',
  'Cayman Is.': 'Cayman Islands',
  'British Virgin Is.': 'British Virgin Islands',
  'Turks and Caicos Is.': 'Turks and Caicos Islands',
  'S. Sudan': 'South Sudan',
  'Solomon Is.': 'Solomon Islands',
  'St. Vin. and Gren.': 'Saint Vincent and the Grenadines',
  'St. Kitts and Nevis': 'Saint Kitts and Nevis',
  'Cook Is.': 'Cook Islands',
  'W. Sahara': 'Western Sahara',
  'St. Pierre and Miquelon': 'Saint Pierre and Miquelon',
  'Wallis and Futuna Is.': 'Wallis and Futuna',
  'Fr. Polynesia': 'French Polynesia',
  'Fr. S. Antarctic Lands': 'French Southern and Antarctic Lands',
  'Eq. Guinea': 'Equatorial Guinea',
  'Dominican Rep.': 'Dominican Republic',
  'Faeroe Is.': 'Faroe Islands',
  'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  'Central African Rep.': 'Central African Republic',
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'Heard I. and McDonald Is.': 'Heard Island and McDonald Islands',
  'Antigua and Barb.': 'Antigua and Barbuda',
};

/** A country name with Natural Earth's abbreviations spelled out. */
export function fullName(name: string): string {
  return FULL_NAMES[name] ?? name;
}
