"""Isolate optional ML dependencies; readiness probes never load models."""
import asyncio
import importlib
import inspect
import threading
import time
from fastapi import HTTPException
from loguru import logger


class LazyService:
    def __init__(self, module, class_name):
        self.module = module
        self.class_name = class_name
        self.instance = None
        self.state = "not_loaded"
        self.retry_at = 0
        self.lock = threading.Lock()

    def status(self):
        return {"status": self.state}

    def _load(self):
        with self.lock:
            if self.instance is not None:
                return self.instance
            if time.monotonic() < self.retry_at:
                raise HTTPException(503, "Analysis service is temporarily unavailable.")
            self.state = "loading"
            try:
                cls = getattr(importlib.import_module(self.module), self.class_name)
                self.instance = cls()
                self.state = "loaded"
                return self.instance
            except Exception as error:
                self.state = "unavailable"
                self.retry_at = time.monotonic() + 30
                logger.warning("Optional service {} failed to initialize ({})", self.class_name, type(error).__name__)
                raise HTTPException(503, "Analysis service is temporarily unavailable.") from None

    def __getattr__(self, name):
        async def invoke(*args, **kwargs):
            instance = await asyncio.to_thread(self._load)
            method = getattr(instance, name)
            if inspect.iscoroutinefunction(method):
                return await method(*args, **kwargs)
            return await asyncio.to_thread(method, *args, **kwargs)
        return invoke
