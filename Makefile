.PHONY: help check sync-indexes new-adr new-exp build devcontainer-up devcontainer-check

TSX ?= npx tsx

help:
	@echo "zmem-research Repository Automation (TypeScript / tsx)"
	@echo ""
	@echo "Targets:"
	@echo "  make check                     Run repository consistency tests across docs/ (wikilinks, citations, schema, numbering)"
	@echo "  make sync-indexes              Regenerate docs/INDEX.md and README.md auto-index sections"
	@echo "  make build                     Build static Preact + Tailwind HTML site into dist/ for GitHub Pages"
	@echo "  make new-adr SLUG=<slug>       Create next sequential ADR in docs/adr/NNN-<slug>.md"
	@echo "  make new-exp SLUG=<slug>       Create dated experiment log in docs/experiments/YYYY-MM-DD-<slug>.md"
	@echo "  make devcontainer-up           Start/build the devcontainer environment"
	@echo "  make devcontainer-check        Execute consistency checks inside the devcontainer"

check:
	$(TSX) scripts/check_consistency.ts

sync-indexes:
	$(TSX) scripts/gen.ts sync-indexes

build:
	$(TSX) scripts/build_site.ts

new-adr:
	@if [ -z "$(SLUG)" ]; then echo "Usage: make new-adr SLUG=<kebab-case-slug>"; exit 1; fi
	$(TSX) scripts/gen.ts new-adr "$(SLUG)"

new-exp:
	@if [ -z "$(SLUG)" ]; then echo "Usage: make new-exp SLUG=<kebab-case-slug>"; exit 1; fi
	$(TSX) scripts/gen.ts new-exp "$(SLUG)"

devcontainer-up:
	devcontainer up --workspace-folder .

devcontainer-check:
	devcontainer exec --workspace-folder . npx tsx scripts/check_consistency.ts
