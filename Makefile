.PHONY: dev-api dev-worker dev

dev-api:
	. .venv/bin/activate && uvicorn apps.api.src.main:app --reload --port 8000

dev-worker:
	. .venv/bin/activate && uvicorn apps.worker.src.main:app --reload --port 8001

dev:
	@echo "Run in two terminals:"
	@echo "  make dev-api"
	@echo "  make dev-worker"
