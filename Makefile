# Bilad: one entry point for the data pipeline (Python), the statistics
# summary (TypeScript, shared with the browser) and the site.
#
#   make install                 Node and Python dependencies
#   make data                    rebuild every nation from NASA POWER
#   make data NATIONS="PER KEN"  rebuild some nations (add new ones to pipeline/nations.py)
#   make global                  rebuild the global atlas (every land cell, 60°S–84°N)
#   make check                   everything CI runs
#   make dev                     local site at http://localhost:5173

PY      ?= python3
NODE    ?= node --experimental-strip-types --no-warnings
NATIONS ?=

.PHONY: install data global summary crosscheck validate test lint build budget smoke check dev

install:
	pnpm install
	$(PY) -m pip install -r pipeline/requirements.txt

data:
	$(PY) -m pipeline build $(if $(NATIONS),$(NATIONS),--all)
	$(PY) -m pipeline context $(if $(NATIONS),$(NATIONS),--all)
	$(MAKE) summary crosscheck

# Every land cell on Earth (60°S–84°N); run after `data` so witnesses exist.
global:
	$(PY) -m pipeline global
	$(PY) -m pipeline crosscheck
	$(NODE) scripts/summarize-global.ts

summary:
	$(NODE) scripts/summarize.ts

crosscheck:
	$(PY) -m pipeline crosscheck

validate:
	$(PY) -m pipeline validate

test:
	pnpm test
	$(PY) -m unittest discover -s tests -p 'test_*.py'

lint:
	pnpm lint

build:
	pnpm build

budget: build
	$(PY) scripts/bundle_budget.py

smoke: build
	pnpm smoke

check: test lint budget validate smoke

dev:
	pnpm dev
