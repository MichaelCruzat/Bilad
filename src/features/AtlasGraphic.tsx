import {REGIONS, type RegionId} from '../data/trends';

type AtlasGraphicProps = {
  primaryId: RegionId;
  comparisonId: RegionId | null;
};

const xFor = (longitude: number) => 58 + ((longitude + 180) / 360) * 604;
const yFor = (latitude: number) => 42 + ((90 - latitude) / 180) * 350;

export function AtlasGraphic({primaryId, comparisonId}: AtlasGraphicProps) {
  const primary = REGIONS.find(region => region.id === primaryId)!;
  const comparison = REGIONS.find(region => region.id === comparisonId);

  return (
    <svg
      role="img"
      aria-label={`Coordinate field showing ${primary.name}${comparison ? ` and ${comparison.name}` : ''} sample points`}
      viewBox="0 0 720 470"
      style={{width: '100%', height: 'auto', display: 'block'}}>
      <defs>
        <linearGradient id="atlas-wash" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-background-card)" />
          <stop offset="0.55" stopColor="var(--color-background-surface)" />
          <stop offset="1" stopColor="var(--color-background-card)" />
        </linearGradient>
        <radialGradient id="atlas-glow">
          <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.32" />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="720" height="470" rx="2" fill="url(#atlas-wash)" />
      <circle cx={xFor(primary.longitude)} cy={yFor(primary.latitude)} r="145" fill="url(#atlas-glow)" />
      {Array.from({length: 10}, (_, index) => (
        <line key={`meridian-${index}`} x1={58 + index * 67} x2={58 + index * 67} y1="42" y2="392" stroke="var(--color-border)" />
      ))}
      {Array.from({length: 6}, (_, index) => (
        <line key={`parallel-${index}`} x1="58" x2="662" y1={42 + index * 70} y2={42 + index * 70} stroke="var(--color-border)" />
      ))}
      <path d="M 58 263 C 154 179 241 315 340 218 S 501 96 662 161" fill="none" stroke="var(--color-accent)" strokeOpacity="0.17" strokeWidth="42" />
      <path d="M 58 263 C 154 179 241 315 340 218 S 501 96 662 161" fill="none" stroke="var(--color-accent)" strokeOpacity="0.48" strokeWidth="1" />
      <path d="M 58 330 C 164 266 240 364 344 290 S 494 198 662 228" fill="none" stroke="var(--color-text-secondary)" strokeOpacity="0.34" strokeWidth="1" />
      <path d="M 58 192 C 158 115 255 236 354 141 S 543 35 662 91" fill="none" stroke="var(--color-text-secondary)" strokeOpacity="0.34" strokeWidth="1" />
      {REGIONS.map(region => {
        const isPrimary = region.id === primaryId;
        const isComparison = region.id === comparisonId;
        return (
          <g key={region.id}>
            {(isPrimary || isComparison) && <circle cx={xFor(region.longitude)} cy={yFor(region.latitude)} r="17" fill="none" stroke={isPrimary ? 'var(--color-text-primary)' : 'var(--color-accent)'} strokeOpacity="0.55" />}
            <circle cx={xFor(region.longitude)} cy={yFor(region.latitude)} r={isPrimary || isComparison ? 5 : 2.5} fill={isPrimary ? 'var(--color-text-primary)' : isComparison ? 'var(--color-accent)' : 'var(--color-text-secondary)'} />
          </g>
        );
      })}
      <text x="58" y="24" fill="var(--color-text-accent)" fontSize="11" letterSpacing="3">BILAD / FIELD 01</text>
      <text x="662" y="24" textAnchor="end" fill="var(--color-text-secondary)" fontSize="11" letterSpacing="2">2000—2024</text>
      <text x="58" y="430" fill="var(--color-text-secondary)" fontSize="11" letterSpacing="2">POINT SAMPLES · EQUIRECTANGULAR GRID</text>
      <text x="662" y="430" textAnchor="end" fill="var(--color-text-accent)" fontSize="11" letterSpacing="2">NASA POWER / AG</text>
    </svg>
  );
}
