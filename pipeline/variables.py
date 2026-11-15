"""The NASA POWER variables Bilad ships, and the window and baseline.

Mirrors ``src/data/variables.ts`` (the app's copy); ``tests/test_pipeline.py``
fails if the two disagree.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Variable:
    id: str
    scale: float  # Int16 quantisation step, in NASA POWER units


VARIABLES: tuple[Variable, ...] = (
    Variable("T2M", 0.01),
    Variable("T2M_MAX", 0.01),
    Variable("T2M_MIN", 0.01),
    Variable("PRECTOTCORR", 0.01),
    Variable("GWETROOT", 0.0001),
    Variable("RH2M", 0.01),
    Variable("WS2M", 0.001),
)

FIRST_YEAR = 1981
LAST_YEAR = 2024
YEARS = LAST_YEAR - FIRST_YEAR + 1
MONTHS = YEARS * 12
MISSING = -32768
