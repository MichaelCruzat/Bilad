"""Nation registry. Adding a nation is one entry here plus ``make data NATIONS=<ISO3>``.

``atlas_id`` is the ISO 3166-1 numeric code used by Natural Earth / world-atlas.
``clip`` optionally restricts the analysed area, for example to leave out
remote islands whose grid cells would be almost all ocean.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Clip:
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float

    def contains(self, lat: float, lon: float) -> bool:
        return self.lat_min <= lat <= self.lat_max and self.lon_min <= lon <= self.lon_max


@dataclass(frozen=True)
class Region:
    id: str
    name: str
    lat_min: float
    lat_max: float


@dataclass(frozen=True)
class Nation:
    iso3: str
    atlas_id: str
    name: str
    rationale: str
    clip: Clip | None = None
    regions: tuple[Region, ...] = field(default_factory=tuple)


NATIONS: tuple[Nation, ...] = (
    Nation(
        "CHL", "152", "Chile",
        "4,300 km from the Atacama to Patagonia: one nation spanning almost every climate zone, and home to a well-documented megadrought.",
        clip=Clip(-56.5, -17, -76.5, -66),
        regions=(
            # Contiguous on the 0.5° grid: every Chilean cell belongs to exactly one region.
            Region("north", "Norte (Atacama and Coquimbo)", -29.75, -17),
            Region("central", "Central Chile", -38, -30),
            Region("south", "Sur and Patagonia", -56.5, -38.25),
        ),
    ),
    Nation("KEN", "404", "Kenya", "Equatorial East Africa, where the reanalysis sees only about half the warming that weather stations record."),
    Nation("MAR", "504", "Morocco", "A Mediterranean-to-Saharan gradient in a region climate assessments flag as a drying hotspot."),
    Nation("BGD", "050", "Bangladesh", "A monsoon delta whose reanalysis record jumps in 1997–98: the case that shows why every trend needs an independent witness."),
    Nation(
        "ESP", "724", "Spain",
        "Mainland Spain and the Balearics: a high-data European benchmark against which other nations can be compared.",
        clip=Clip(35.5, 44, -9.5, 4.5),
    ),
    Nation(
        "PHL", "608", "Philippines",
        "An archipelago of more than 7,000 islands in the typhoon belt, one of the nations most exposed to climate hazards.",
        regions=(
            Region("luzon", "Luzon", 12.5, 21.5),
            Region("visayas", "Visayas", 9.25, 12.25),
            Region("mindanao", "Mindanao", 4.5, 9),
        ),
    ),
    Nation("MEX", "484", "Mexico", "A large, topographically complex nation with deserts, tropical forests and recurrent multi-year drought."),
)


def get_nation(iso3: str) -> Nation:
    for nation in NATIONS:
        if nation.iso3 == iso3.upper():
            return nation
    raise SystemExit(f"Unknown nation {iso3}. Add it to pipeline/nations.py.")
