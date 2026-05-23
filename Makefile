SHELL := /bin/sh

.DEFAULT_GOAL := help

IMAGE ?= zizmor-slsa-report
TAG ?= latest
PORT ?= 4173

.PHONY: help install dev start test check zizmor-check docker-build docker-run clean

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make \033[36m<target>\033[0m\n\n"} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install Node.js dependencies
	npm install

dev: ## Start the development server with file watching
	npm run dev

start: ## Start the application
	npm start

test: ## Run the unit test suite
	npm test

check: test ## Run tests and JavaScript syntax checks
	node --check server.js
	node --check public/app.js

zizmor-check: ## Verify that zizmor is installed
	@command -v zizmor >/dev/null 2>&1 || { echo "zizmor is not installed: https://docs.zizmor.sh/installation/"; exit 1; }
	zizmor --version

docker-build: ## Build the container image
	docker build -t $(IMAGE):$(TAG) .

docker-run: ## Run the container on PORT (default: 4173)
	docker run --rm -p $(PORT):4173 $(IMAGE):$(TAG)

clean: ## Remove local test and debug artifacts
	rm -rf coverage npm-debug.log*
