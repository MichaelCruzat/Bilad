# Bilad: one entry point for the data pipeline (Python), the statistics
# summary (TypeScript, shared with the browser) and the site.
#
#   make install                 Node and Python dependencies
#   make data                    rebuild every nation from NASA POWER
#   make data NATIONS="PER KEN"  rebuild some nations (add new ones to pipeline/nations.py)
#   make check                   everything CI runs
#   make dev                     local site at http://localhost:5173

PY      ?= python3
NODE    ?= node --experimental-strip-types --no-warnings
NATIONS ?=

.PHONY: install data summary crosscheck validate test lint build budget check dev

install:
	pnpm install
	$(PY) -m pip install -r pipeline/requirements.txt

data:
	$(PY) -m pipeline build $(if $(NATIONS),$(NATIONS),--all)
	$(MAKE) summary crosscheck

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

check: test lint budget validate

dev:
	pnpm dev
