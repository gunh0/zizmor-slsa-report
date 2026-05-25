SHELL := /bin/sh

.DEFAULT_GOAL := help

IMAGE ?= zizmor-slsa-report
TAG ?= latest
PORT ?= 4173
ZIZMOR_VERSION ?= 1.30.1
TOOLS_DIR ?= .tools

.PHONY: help setup install install-zizmor dev start test check zizmor-check docker-build docker-run clean

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make \033[36m<target>\033[0m\n\n"} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install Node.js dependencies
	npm install

setup: install install-zizmor ## Install all local development dependencies

install-zizmor: ## Download zizmor into the project tool directory
	@set -eu; \
	os=$$(uname -s); arch=$$(uname -m); \
	case "$$os-$$arch" in \
	  Darwin-arm64) target="aarch64-apple-darwin" ;; \
	  Darwin-x86_64) target="x86_64-apple-darwin" ;; \
	  Linux-aarch64|Linux-arm64) target="aarch64-unknown-linux-gnu" ;; \
	  Linux-x86_64) target="x86_64-unknown-linux-gnu" ;; \
	  *) echo "Unsupported platform: $$os $$arch" >&2; exit 1 ;; \
	esac; \
	mkdir -p "$(TOOLS_DIR)"; \
	archive="$(TOOLS_DIR)/zizmor.tar.gz"; \
	url="https://github.com/zizmorcore/zizmor/releases/download/v$(ZIZMOR_VERSION)/zizmor-$$target.tar.gz"; \
	echo "Downloading zizmor $(ZIZMOR_VERSION) for $$target..."; \
	curl -fsSL "$$url" -o "$$archive"; \
	tar -xzf "$$archive" -C "$(TOOLS_DIR)"; \
	rm -f "$$archive"; \
	chmod +x "$(TOOLS_DIR)/zizmor"; \
	"$(TOOLS_DIR)/zizmor" --version

dev: ## Start the development server with file watching
	npm run dev

start: ## Start the application
	npm start

test: ## Run the unit test suite
	npm test

check: test ## Run tests and JavaScript syntax checks
	node --check server.js
	node --check public/app.js

zizmor-check: ## Verify the project-local zizmor installation
	@test -x "$(TOOLS_DIR)/zizmor" || { echo "zizmor is not installed. Run: make setup"; exit 1; }
	$(TOOLS_DIR)/zizmor --version

docker-build: ## Build the container image
	docker build -t $(IMAGE):$(TAG) .

docker-run: ## Run the container on PORT (default: 4173)
	docker run --rm -p $(PORT):4173 $(IMAGE):$(TAG)

clean: ## Remove local test and debug artifacts
	rm -rf coverage npm-debug.log*
