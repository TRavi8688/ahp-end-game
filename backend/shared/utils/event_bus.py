"""
shared/utils/event_bus.py

Async Event Bus using Redis Streams with Dead Letter Queue support.

FIX: Wrong import path `from backend.shared.redis_client import get_redis`
     → `from shared.redis_client import get_redis_client`

PLACE AT: backend/shared/utils/event_bus.py
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Callable, Dict

from shared.redis_client import get_redis_client

logger = logging.getLogger(__name__)


class EventBus:
    """
    Async Event Sourcing using Redis Streams.
    Includes automatic Dead Letter Queue (DLQ) routing for failed events.
    """

    @staticmethod
    async def publish(topic: str, payload: dict) -> str | None:
        """Publish an event to a topic (Redis Stream). Returns message ID or None."""
        try:
            redis = get_redis_client()
        except RuntimeError:
            logger.warning("EventBus: Redis not initialised, cannot publish to %s", topic)
            return None

        try:
            flat_payload = {"data": json.dumps(payload)}
            message_id = await redis.xadd(topic, flat_payload)
            logger.debug("EventBus published to %s id=%s", topic, message_id)
            return message_id
        except Exception as e:
            logger.error("EventBus failed to publish to %s: %s", topic, e)
            return None

    @staticmethod
    async def consume(
        topic: str,
        group: str,
        consumer_name: str,
        callback: Callable[[Dict[str, Any]], Any],
        max_retries: int = 3,
    ) -> None:
        """
        Consume events from a topic as part of a consumer group.
        Failed events are routed to a DLQ after max_retries.
        Runs indefinitely — call from a background task.
        """
        try:
            redis = get_redis_client()
        except RuntimeError:
            logger.error("EventBus: Redis not initialised, cannot consume %s", topic)
            return

        # Ensure consumer group exists
        try:
            await redis.xgroup_create(topic, group, id="0", mkstream=True)
        except Exception as e:
            if "BUSYGROUP" not in str(e):
                logger.error("Error creating consumer group %s for %s: %s", group, topic, e)

        logger.info("EventBus consuming %s as %s in group %s", topic, consumer_name, group)

        while True:
            try:
                events = await redis.xreadgroup(
                    group, consumer_name, {topic: ">"}, count=1, block=5000
                )
                if not events:
                    continue

                for _stream, messages in events:
                    for message_id, message_data in messages:
                        try:
                            payload = json.loads(message_data.get("data", "{}"))
                            await callback(payload)
                            await redis.xack(topic, group, message_id)
                        except Exception as process_error:
                            logger.error(
                                "EventBus error processing %s from %s: %s",
                                message_id, topic, process_error,
                            )
                            await EventBus._handle_failure(
                                redis, topic, group, message_id, message_data, max_retries
                            )

            except Exception as read_error:
                logger.error("EventBus read error on %s: %s", topic, read_error)
                await asyncio.sleep(5)

    @staticmethod
    async def _handle_failure(
        redis,
        topic: str,
        group: str,
        message_id: str,
        message_data: dict,
        max_retries: int,
    ) -> None:
        """Check retry count. Move to DLQ if max exceeded."""
        try:
            pel = await redis.xpending_ext(topic, group, message_id, message_id, 1)
            if not pel:
                return

            delivery_count = pel[0]["delivery_count"]

            if delivery_count >= max_retries:
                logger.warning(
                    "EventBus: %s on %s reached max retries (%d). Moving to DLQ.",
                    message_id, topic, delivery_count,
                )
                dlq_topic = f"dlq:{topic}"
                dlq_payload = {
                    "original_id": message_id,
                    "original_data": message_data.get("data", "{}"),
                    "group": group,
                    "error": "Max retries exceeded",
                }
                await redis.xadd(dlq_topic, dlq_payload)
                await redis.xack(topic, group, message_id)
        except Exception as e:
            logger.error("EventBus DLQ routing failed for %s: %s", message_id, e)
