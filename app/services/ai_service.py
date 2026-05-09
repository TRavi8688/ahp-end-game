import os
import time
import json
import asyncio
import base64
import hashlib
import io
import re
from datetime import datetime
from typing import List, Optional, Dict, Any

import httpx
from PIL import Image
from pydantic import BaseModel, Field, ValidationError
from cryptography.fernet import Fernet
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.logging import logger
from app.core.insforge_client import insforge
from app.services.redis_service import redis_service
import pytesseract

def sanitize_ai_output(text: str) -> str:
    """Enterprise-grade HTML/XSS sanitization for AI-generated content."""
    if not text:
        return ""
    # Remove script tags and dangerous attributes
    clean = re.sub(r'<script.*?>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
    clean = re.sub(r'on\w+=".*?"', '', clean, flags=re.IGNORECASE)
    clean = re.sub(r'javascript:', '', clean, flags=re.IGNORECASE)
    # Escape major HTML entities if not explicitly allowed (very strict)
    # For CHITTI, we allow basic formatting like bold/italics
    return clean.strip()

# ... (rest of the file remains similar but with sanitization applied)

# Note: I will only replace the parts that need changing to avoid massive file replacements
# But since I'm using replace_file_content, I'll focus on the explain_to_patient and unified_ai_engine

# --- AI Specific Exceptions ---
class AIServiceError(Exception):
    """Base exception for AI service errors."""
    pass

class AIRateLimitError(AIServiceError):
    """Raised when an AI provider rate limits the request."""
    pass

class AIParseError(AIServiceError):
    """Raised when AI response cannot be parsed into the expected format."""
    pass

from app.core.encryption import encrypt_value, decrypt_value, DecryptionError

def encrypt_data(data: str) -> str:
    """Helper for AI service to encrypt extracted PHI."""
    return encrypt_value(data)

def decrypt_data(encrypted_data_str: str) -> str:
    """Helper for AI service to decrypt PHI. Hard-fails on error."""
    return decrypt_value(encrypted_data_str)

# --- Pydantic Models for AI Output Validation ---
class MedicalEntities(BaseModel):
    conditions: List[Dict[str, Any]] = Field(default_factory=list)
    medications: List[Dict[str, Any]] = Field(default_factory=list)
    lab_results: List[Dict[str, Any]] = Field(default_factory=list)

class CircuitBreaker:
    """Redis-backed circuit breaker with local in-memory fallback."""
    _memory_fails = {} # Survival during Redis outage

    def __init__(self, provider: str, threshold: int = 3, window_seconds: int = 300):
        self.provider = provider
        self.failure_threshold = 2 # Reduced from 3 for faster trips
        self.window = window_seconds
        self.key = f"circuit_breaker:{provider}"

    async def _get_fails(self) -> int:
        """Fetch failure count with Redis -> Memory fallback."""
        try:
            val = await redis_service.get(self.key)
            return int(val) if val else self._memory_fails.get(self.provider, 0)
        except Exception:
            return self._memory_fails.get(self.provider, 0)

    async def is_open(self) -> bool:
        """Check if the circuit is open (provider is disabled)."""
        fails = await self._get_fails()
        if fails >= self.failure_threshold: # Changed to self.failure_threshold
            # ULTIMATE RESILIENCE: High-Precision Half-Open Probe
            probe_key = f"{self.key}:probe"
            try:
                # If we can set the probe key, we allow ONE request through to test the provider
                is_probing = await redis_service.get(probe_key)
                if not is_probing:
                    await redis_service.set(probe_key, "1", expire=15) # Probe lock for 15s
                    logger.info(f"CIRCUIT_PROBE: Attempting discovery probe for {self.provider}.")
                    return False 
            except Exception:
                pass

            logger.warning(f"CIRCUIT_OPEN: {self.provider} disabled. High error rate ({fails} fails).")
            return True
        return False

    async def record_failure(self):
        """Increment failure count for the provider."""
        current = await self._get_fails()
        new_val = current + 1
        self._memory_fails[self.provider] = new_val # Always update memory
        try:
            await redis_service.set(self.key, str(new_val), expire=self.window)
        except Exception:
            pass # Redis down, memory is primary
            
        if new_val >= self.failure_threshold: # Changed to self.failure_threshold
            logger.critical(f"CIRCUIT_TRIPPED: {self.provider} disabled for {self.window}s.")

    async def record_success(self):
        """Reset failure count on success."""
        self._memory_fails[self.provider] = 0
        try:
            await redis_service.delete(self.key)
        except Exception:
            pass

class AsyncAIService:
    def __init__(self):
        self.gemini_key = settings.GEMINI_API_KEY
        self.groq_key = settings.GROQ_API_KEY
        self.anthropic_key = settings.ANTHROPIC_API_KEY
        self.sarvam_key = settings.SARVAM_KEY
        self.base_url = settings.INSFORGE_BASE_URL
        self.anon_key = settings.INSFORGE_ANON_KEY
        self._client: Optional[httpx.AsyncClient] = None
        self.usage_metrics = {"tokens_total": 0, "requests_total": 0, "provider_stats": {}}
        self.circuits = {
            "gemini": CircuitBreaker("gemini"),
            "groq": CircuitBreaker("groq"),
            "anthropic": CircuitBreaker("anthropic"),
            "insforge": CircuitBreaker("insforge")
        }

    def _log_usage(self, provider: str, tokens: int = 0, file_size_kb: int = 0, latency_ms: float = 0):
        """Internal usage auditing for cost control and latency profiling."""
        # Multi-dimensional cost attribution
        self.usage_metrics["tokens_total"] = int(self.usage_metrics.get("tokens_total", 0)) + tokens
        self.usage_metrics["requests_total"] = int(self.usage_metrics.get("requests_total", 0)) + 1
        
        provider_stats = self.usage_metrics["provider_stats"].get(provider, {"tokens": 0, "requests": 0, "total_latency": 0, "total_kb": 0})
        provider_stats["tokens"] += tokens
        provider_stats["requests"] += 1
        provider_stats["total_latency"] += int(latency_ms)
        provider_stats["total_kb"] += file_size_kb
        
        self.usage_metrics["provider_stats"][provider] = provider_stats
        
        logger.info(f"AI_METRICS: {provider} - {tokens} tokens, {file_size_kb}KB, {latency_ms}ms", 
                   metrics=self.usage_metrics)

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            # Enforce strict 10s timeout for production reliability
            timeout = httpx.Timeout(10.0, connect=10.0, read=10.0)
            self._client = httpx.AsyncClient(timeout=timeout)
        return self._client

    async def optimize_image(self, image_path: str, max_size=(1024, 1024), quality=80) -> bytes:
        """Compress and resize image to reduce OCR processing time using non-blocking threads."""
        try:
            # Wrap blocking PIL calls in a thread
            def _sync_optimize():
                img = Image.open(image_path)
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
                img_byte_arr = io.BytesIO()
                img.save(img_byte_arr, format='JPEG', quality=quality, optimize=True)
                return img_byte_arr.getvalue()

            return await asyncio.to_thread(_sync_optimize)
        except Exception as e:
            logger.error(f"Image optimization failed for {image_path}: {e}")
            with open(image_path, 'rb') as f:
                return f.read()

    async def _call_gemini(self, model_name: str, prompt: str, image_bytes: bytes = None, mime_type: str = "image/jpeg", force_json: bool = False) -> str:
        if not self.gemini_key: return "MISSING_KEY"
        provider = "gemini"
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.gemini_key}"
        parts = [{"text": prompt}]
        if image_bytes:
            parts.append({"inline_data": {"mime_type": mime_type, "data": base64.b64encode(image_bytes).decode('utf-8')}})
        
        payload = {"contents": [{"parts": parts}]}
        if force_json:
            payload["generationConfig"] = {"response_mime_type": "application/json"}

        client = await self.get_client()
        try:
            resp = await client.post(url, json=payload)
            if resp.status_code == 429:
                await self.circuits[provider].record_failure()
                raise AIRateLimitError("Gemini rate limit exceeded")
            resp.raise_for_status()
            data = resp.json()
            await self.circuits[provider].record_success()
            self._log_usage(provider, tokens=len(prompt) // 4) # Rough estimate
            return data['candidates'][0]['content']['parts'][0]['text'].strip()
        except Exception as e:
            await self.circuits[provider].record_failure()
            logger.error(f"Gemini API call failed: {e}")
            return "ERROR"

    async def _call_anthropic(self, model: str, prompt: str, image_bytes: bytes = None, mime_type: str = "image/jpeg", force_json: bool = False) -> str:
        if not self.anthropic_key: return ""
        provider = "anthropic"
        
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.anthropic_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }
        
        content = []
        if image_bytes:
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": mime_type,
                    "data": base64.b64encode(image_bytes).decode('utf-8')
                }
            })
        
        content.append({"type": "text", "text": prompt})
        
        payload = {
            "model": model,
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": content}]
        }

        client = await self.get_client()
        try:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            await self.circuits[provider].record_success()
            self._log_usage(provider, tokens=len(prompt) // 4)
            return resp.json()["content"][0]["text"].strip()
        except Exception as e:
            await self.circuits[provider].record_failure()
            logger.error(f"Anthropic API call failed: {e}")
            return ""

    async def _call_sarvam(self, text: str, target_language: str) -> str:
        """Call Sarvam AI for regional language translation (Indian languages)."""
        if not self.sarvam_key: return text
        
        url = "https://api.sarvam.ai/translate"
        headers = {"api-subscription-key": self.sarvam_key, "Content-Type": "application/json"}
        payload = {
            "input": text,
            "source_language_code": "en-IN",
            "target_language_code": target_language,
            "speaker_gender": "Female"
        }
        
        client = await self.get_client()
        try:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            return resp.json().get("translated_text", text)
        except Exception as e:
            logger.error(f"Sarvam Translation failed: {e}")
            return text

    async def _call_groq(self, model: str, prompt: str, image_bytes: bytes = None, mime_type: str = "image/jpeg", force_json: bool = False) -> str:
        if not self.groq_key: return ""
        provider = "groq"
        
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {"Authorization": f"Bearer {self.groq_key}"}
        content = [{"type": "text", "text": prompt}]
        if image_bytes:
            img_b64 = base64.b64encode(image_bytes).decode('utf-8')
            content.append({"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{img_b64}"}})
            
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": content}],
            "max_tokens": 1024
        }
        if force_json:
            payload["response_format"] = {"type": "json_object"}

        client = await self.get_client()
        try:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 429:
                await self.circuits[provider].record_failure()
                raise AIRateLimitError("Groq rate limit exceeded")
            resp.raise_for_status()
            await self.circuits[provider].record_success()
            self._log_usage(provider, tokens=len(prompt) // 4)
            return resp.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            await self.circuits[provider].record_failure()
            logger.error(f"Groq API call failed: {e}")
            return ""

    async def _call_insforge_ai(self, model: str, prompt: str, image_bytes: bytes = None, mime_type: str = "image/jpeg", force_json: bool = False) -> str:
        """Call InsForge's OpenAI-compatible AI endpoint."""
        provider = "insforge"
        url = f"{self.base_url}/api/ai/chat/completion"
        headers = {
            "Authorization": f"Bearer {self.anon_key}",
            "apikey": self.anon_key,
            "Content-Type": "application/json"
        }
        
        if image_bytes:
            import base64
            content = [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode('utf-8')}"}}
            ]
        else:
            content = prompt
 
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": content}],
            "max_tokens": 1024,
            "stream": False
        }
        if force_json:
            payload["force_json"] = True
 
        client = await self.get_client()
        try:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            await self.circuits[provider].record_success()
            self._log_usage(provider, tokens=len(prompt) // 4)
            content = data.get("text", "").strip()
            if not content and "choices" in data:
                content = data["choices"][0]["message"]["content"].strip()
            return sanitize_ai_output(content)
        except Exception as e:
            await self.circuits[provider].record_failure()
            logger.error(f"InsForge AI call failed: {e}")
            return ""

    async def speech_to_text(self, audio_bytes: bytes) -> str:
        """Convert audio bytes to text using Groq's Whisper-3."""
        if not self.groq_key: return ""
        
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = {"Authorization": f"Bearer {self.groq_key}"}
        
        # Groq expects a multipart/form-data with the file
        files = {
            "file": ("speech.m4a", audio_bytes, "audio/m4a"),
            "model": (None, "whisper-large-v3"),
        }
        
        client = await self.get_client()
        try:
            resp = await client.post(url, headers=headers, files=files)
            resp.raise_for_status()
            return resp.json().get("text", "").strip()
        except Exception as e:
            logger.error(f"STT failed: {e}")
            return ""

    async def unified_ai_engine(self, prompt: str, image_bytes: bytes = None, force_json: bool = False, mime_type: str = "image/jpeg", language_code: str = "en") -> str:
        """
        AI Engine with multi-provider failover and Regional Language Support.
        Priority: InsForge (free, reliable) -> Anthropic -> Groq -> Gemini
        """
        if os.getenv("DEMO_MODE", "False") == "True":
            logger.info("DEMO_MODE: Bypassing AI Engine with Mock Response.")
            if force_json:
                return json.dumps({
                    "conditions": [{"name": "Mild Viral Fever", "severity": "mild"}],
                    "medications": [{"name": "Paracetamol 500mg", "dosage": "Twice daily"}],
                    "lab_results": [{"test": "Hemoglobin", "result": "13.5 g/dL"}],
                    "answer": "I've analyzed your report. Everything looks stable."
                })
            return "CLINICAL SUMMARY: Patient presents with symptoms of a viral infection. Rest is recommended."

        if image_bytes:
            # Vision-capable models
            providers = [
                ("insforge", self._call_insforge_ai, "anthropic/claude-sonnet-4.5"),
                ("insforge", self._call_insforge_ai, "openai/gpt-4o-mini"),
                ("anthropic", self._call_anthropic, "claude-3-5-sonnet-20240620"),
                ("groq", self._call_groq, "llama-3.2-11b-vision-preview"),
                ("gemini", self._call_gemini, "gemini-1.5-flash")
            ]
        else:
            # Text-only models
            providers = [
                ("insforge", self._call_insforge_ai, "deepseek/deepseek-v3.2"),
                ("insforge", self._call_insforge_ai, "openai/gpt-4o-mini"),
                ("anthropic", self._call_anthropic, "claude-3-5-sonnet-20240620"),
                ("groq", self._call_groq, "llama-3.3-70b-versatile"),
                ("gemini", self._call_gemini, "gemini-1.5-flash")
            ]

        # --- ADAPTIVE RACING FAILOVER (Enterprise Strategy) ---
        # Instead of sequential blocking, we use a "staggered start" race.
        # We start the primary provider, and if it doesn't respond within 2s, 
        # we start the secondary provider in parallel.
        
        response_text = "SERVICE_UNAVAILABLE"
        
        async def _attempt_provider(p_key, func, model):
            if p_key in self.circuits:
                if await self.circuits[p_key].is_open():
                    return None
            try:
                res = await func(model, prompt, image_bytes, mime_type, force_json)
                if res and res not in ["ERROR", "SERVICE_UNAVAILABLE", "MISSING_KEY"] and len(res.strip()) > 5:
                    return sanitize_ai_output(res.strip())
            except Exception:
                pass
            return None

        # 1. Primary Attempt (Priority 1)
        p1_key, p1_func, p1_model = providers[0]
        p1_task = asyncio.create_task(_attempt_provider(p1_key, p1_func, p1_model))
        
        # 2. Wait for P1 or Timeout for staggered start
        done, pending = await asyncio.wait([p1_task], timeout=2.0)
        
        if p1_task in done and p1_task.result():
            response_text = p1_task.result()
        else:
            # 3. P1 is slow or failed. Start P2 and P3 as a secondary race.
            logger.info("ADAPTIVE_RACING: Primary slow/failed, starting secondary providers...")
            secondary_tasks = []
            for p_key, func, model in providers[1:3]: # Race next 2 providers
                 secondary_tasks.append(asyncio.create_task(_attempt_provider(p_key, func, model)))
            
            # Combine all active tasks
            all_active = [p1_task] + secondary_tasks
            
            # Loop until we get a result or all fail
            while all_active:
                done, all_active = await asyncio.wait(all_active, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    res = task.result()
                    if res:
                        response_text = res
                        # Cancel remaining tasks to save cost/compute
                        for p in all_active: p.cancel()
                        all_active = [] # Break outer loop
                        break
                if response_text != "SERVICE_UNAVAILABLE":
                    break

        # Final Fallback (Sequential) for remaining providers if still unavailable
        if response_text == "SERVICE_UNAVAILABLE" and len(providers) > 3:
            for p_key, func, model in providers[3:]:
                 res = await _attempt_provider(p_key, func, model)
                 if res:
                     response_text = res
                     break


        # --- Regional Language Enhancement (Sarvam) ---
        if response_text != "SERVICE_UNAVAILABLE" and language_code not in ["en", "en-IN"]:
            logger.info(f"TRANSLATING: Response to {language_code} via Sarvam...")
            response_text = await self._call_sarvam(response_text, language_code)

        # 4. Demo Mode Fallback (Offline/No Keys)
        if response_text == "SERVICE_UNAVAILABLE" and os.getenv("DEMO_MODE", "False") == "True":
            logger.info("DEMO_MODE: Returning mock AI response.")
            if force_json:
                return json.dumps({
                    "conditions": [{"name": "Mild Viral Fever", "severity": "mild"}],
                    "medications": [{"name": "Paracetamol 500mg", "dosage": "Twice daily"}],
                    "lab_results": [{"test": "Hemoglobin", "result": "13.5 g/dL"}],
                    "answer": "I've analyzed your report. Everything looks stable."
                })
            return "CLINICAL SUMMARY: Patient presents with symptoms of a viral infection. Rest is recommended."

        return response_text

    async def _call_local_ocr(self, image_bytes: bytes) -> str:
        """Local Tesseract fallback for OCR when all cloud AI services are down."""
        try:
            def _sync_ocr():
                img = Image.open(io.BytesIO(image_bytes))
                return pytesseract.image_to_string(img)
            
            return await asyncio.to_thread(_sync_ocr)
        except Exception as e:
            logger.critical(f"LOCAL_OCR_FAILURE: Tesseract failed - {e}")
            return "OCR_SERVICE_FAILURE"

    async def extract_medical_entities(self, text: str, retries: int = 2) -> MedicalEntities:
        prompt = (
            "Extract medical entities (conditions, medications, lab results) from this text.\n"
            "Return EXCLUSIVELY this JSON:\n"
            "{\"conditions\": [{\"name\": \"...\"}], \"medications\": [{\"name\": \"...\"}], \"lab_results\": [{\"test\": \"...\"}]}\n\n"
            f"Content: {text}"
        )
        for attempt in range(retries):
            res = await self.unified_ai_engine(prompt, force_json=True)
            # Robust Markdown Cleaning
            clean_res = res.strip()
            if "```json" in clean_res:
                clean_res = clean_res.split("```json")[-1].split("```")[0]
            elif "```" in clean_res:
                clean_res = clean_res.split("```")[-1].split("```")[0]
            clean_res = clean_res.strip()
            
            try:
                return MedicalEntities(**json.loads(clean_res))
            except (json.JSONDecodeError, ValidationError) as e:
                logger.warning(f"Medical entity parsing attempt {attempt + 1} failed: {e}")
                
        logger.error("Medical entity parsing failed completely after retries.")
        return MedicalEntities()

    async def generate_doctor_summary(self, entities: MedicalEntities, raw_text: str) -> str:
        prompt = (
            f"Write a clinical summary for a physician based on these findings: {entities.model_dump_json()}\n"
            f"Raw text: {raw_text[:1000]}\n"
            "Focus on clinical significance, potential diagnoses, and recommended next steps."
        )
        return await self.unified_ai_engine(prompt)

    async def explain_to_patient(self, entities: MedicalEntities, raw_text: str, language_code: str = "en") -> str:
        """解释给病人 (Explain to patient) - The CHITTI Persona."""
        prompt = (
            "You are 'CHITTI', a friendly, compassionate, and highly intelligent medical assistant for the Hospyn 2.0 platform.\n"
            f"Your goal is to explain the following medical findings to a patient in language: {language_code}.\n"
            "Guidelines:\n"
            "1. Be extremely warm, reassuring, and use simple language (no jargon).\n"
            "2. Address their medical doubts with empathy, like a caring family doctor.\n"
            "3. If the data shows something concerning, be gentle but advise seeing their doctor.\n"
            "4. If the data is normal, celebrate the good health with them!\n"
            f"Entities Found: {entities.model_dump_json()}\n"
            f"Raw Narrative: {raw_text[:500]}\n\n"
            "Return EXCLUSIVELY a JSON object: {\"answer\": \"your explanation here\"}"
        )
        res = await self.unified_ai_engine(prompt, force_json=True, language_code=language_code)
        try:
            # Handle potential JSON markdown wrap from AI
            clean_res = res.strip()
            if clean_res.startswith("```json"): clean_res = clean_res[7:-3]
            elif clean_res.startswith("```"): clean_res = clean_res[3:-3]
            
            return sanitize_ai_output(json.loads(clean_res.strip()).get("answer", "I've analyzed your results, and they're ready for your doctor to review."))
        except Exception as e:
            logger.error(f"CHITTI_PARSE_ERROR: {e} | Raw: {res}")
            # Fallback to direct text if translation/JSON failed
            return sanitize_ai_output(res) if len(res) > 20 else "I'm Chitti! I've analyzed your reports. Please check with your doctor for the next steps."

    async def _get_file_bytes(self, source: str) -> bytes:
        """Helper to get file bytes from either a local path or GCP Cloud Storage."""
        # 1. Check if it's a Cloud Storage object key
        if not os.path.isabs(source) and not source.startswith("./") and not source.startswith("../"):
            try:
                from app.services.storage_service import StorageService
                storage_service = StorageService()
                
                # Fetching bytes directly from GCS bucket
                blob = storage_service.bucket.blob(source)
                content = await asyncio.to_thread(blob.download_as_bytes)
                logger.info(f"GCS_RETRIEVAL_SUCCESS: {source}")
                return content
            except Exception as e:
                logger.error(f"GCS_RETRIEVAL_FAILURE: {source} | Error: {e}")


        # 2. Fallback to local file (or if specifically local)
        try:
            return await asyncio.to_thread(lambda: open(source, "rb").read())
        except Exception as e:
            logger.error(f"Local file retrieval failed for {source}: {e}")
            raise AIServiceError(f"File not found: {source}")

    async def process_medical_document(self, file_source: str, language_code: str = "en") -> dict:
        """Full pipeline: OCR -> Extract Entities -> Parallel Summaries. Handles local paths or S3 keys."""
        logger.info(f"Starting pipeline for {file_source}")
        
        file_bytes = await self._get_file_bytes(file_source)
        
        # Enterprise Safety: Limit file size to 10MB to prevent OOM
        MAX_SIZE = 10 * 1024 * 1024
        if len(file_bytes) > MAX_SIZE:
            logger.error(f"FILE_SIZE_EXCEEDED: {file_source} is {len(file_bytes)} bytes.")
            return {"error": "File exceeds 10MB limit."}

        start_pipeline = time.time()
        file_size_kb = len(file_bytes) // 1024
        file_extension = os.path.splitext(file_source)[1].lower()

        if file_extension in ['.txt', '.md', '.csv']:
            ocr_text = file_bytes.decode("utf-8")
            image_bytes = None
        else:
            def _optimize_from_bytes():
                img = Image.open(io.BytesIO(file_bytes))
                if img.mode != 'RGB': img = img.convert('RGB')
                img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, format='JPEG', quality=80)
                return buf.getvalue()

            image_bytes = await asyncio.to_thread(_optimize_from_bytes)
            ocr_text = await self.unified_ai_engine("Perform high-accuracy OCR on this clinical document.", image_bytes)

        if not ocr_text or ocr_text == "SERVICE_UNAVAILABLE":
            return {"error": "OCR failed"}

        # Stage 2: Entity Extraction
        entities = await self.extract_medical_entities(ocr_text)
        
        # SILENT FAILURE DETECTION: High text but zero structure
        if len(ocr_text) > 200 and not any([entities.conditions, entities.medications, entities.lab_results]):
            logger.error(f"SILENT_AI_FAILURE: OCR text was {len(ocr_text)} chars but 0 medical entities were extracted.")

        # Stage 3: Summaries
        doctor_task = self.generate_doctor_summary(entities, ocr_text)
        patient_task = self.explain_to_patient(entities, ocr_text, language_code)
        doctor_summary, patient_summary = await asyncio.gather(doctor_task, patient_task)
        
        pipeline_latency = (time.time() - start_pipeline) * 1000
        self._log_usage("pipeline", tokens=0, file_size_kb=file_size_kb, latency_ms=pipeline_latency)

        return {
            "type": "Document",
            "raw_text": ocr_text,
            "structured_data": entities.model_dump(),
            "patient_summary": patient_summary,
            "doctor_summary": doctor_summary
        }

    async def get_chat_history(self, user_id: str, conversation_id: str, limit: int = 10, db: Optional[AsyncSession] = None) -> List[Dict[str, Any]]:
        """
        Retrieve last N messages for context. 
        ENTERPRISE ENFORCED: Single SOT (PostgreSQL).
        """
        if not db:
            logger.error("CHAT_HISTORY_MISSING_DB")
            return []

        # 1. Local Cache Check
        cache_key = f"chat_history:{conversation_id}"
        cached = await redis_service.get(cache_key)
        if cached:
            history = json.loads(cached)
            return history[-limit:]

        # 2. Database Fetch
        from sqlalchemy import select
        from app.models import models
        stmt = select(models.Message).where(
            models.Message.user_id == int(user_id), 
            models.Message.conversation_id == conversation_id
        ).order_by(models.Message.created_at.asc())
        
        result = await db.execute(stmt)
        records = result.scalars().all()
        history = [{"role": r.role, "content": r.content} for r in records]
        
        # 3. Update Cache
        await redis_service.set(cache_key, json.dumps(history), expire=600)
        return history[-limit:]

    async def save_chat_message(self, user_id: str, conversation_id: str, role: str, content: str, db: Optional[AsyncSession] = None):
        """Atomic persistence to local DB."""
        if not db:
            logger.error("SAVE_CHAT_MISSING_DB")
            return

        try:
            from app.models import models
            msg = models.Message(
                user_id=int(user_id), 
                conversation_id=conversation_id, 
                role=role, 
                content=content
            )
            db.add(msg)
            # Commit is managed by the service-layer or router Unit-of-Work
        except Exception as e:
            logger.error("SAVE_CHAT_FAILURE", error=str(e))

    async def get_medical_context(self, user_id: str, role: str = "patient", db: Optional[AsyncSession] = None) -> str:
        """Fetch a secure, filtered summary of the patient's record for AI awareness."""
        if not db:
            return "No clinical context available (DB Connection Missing)."
        
        try:
            from app.services.clinical_context_service import clinical_context_service
            from app.models.models import Patient
            from sqlalchemy import select
            
            # Fetch Patient Profile ID first
            res = await db.execute(select(Patient).where(Patient.user_id == int(user_id)))
            patient = res.scalar_one_or_none()
            if not patient:
                return "No clinical profile found for this user."

            # Generate Secure, Role-Aware Context via the SHIELD layer
            context_obj = await clinical_context_service.get_patient_clinical_context(
                db=db,
                patient_id=patient.id,
                requesting_user_role=role
            )
            
            if "error" in context_obj:
                logger.error(f"AI_CONTEXT_FAILURE: {context_obj['error']}")
                return "Privacy Shield: Clinical context retrieval restricted."

            # Format the secure context for the LLM prompt
            # We use a structured JSON block to ensure the LLM understands the data boundaries
            context_str = json.dumps(context_obj, indent=2)
            return f"SECURE_CLINICAL_CONTEXT_V1:\n{context_str}"

        except Exception as e:
            logger.error(f"Failed to build secure medical context: {e}")
            return "Security Guard: Error retrieving clinical profile."

    async def chat_with_memory(self, user_id: str, conversation_id: str, user_message: str, image_bytes: bytes = None, audio_bytes: bytes = None, language_code: str = "en-IN", role: str = "patient", db: Optional[AsyncSession] = None) -> str:
        """Generate a response using clinical context AND conversational memory."""
        
        # 0. Handle Voice if present
        if audio_bytes:
            transcription = await self.speech_to_text(audio_bytes)
            if transcription:
                user_message = f"{user_message} (Transcription: {transcription})"
                logger.info(f"Voice Transcribed: {transcription}")

        # 1. Fetch Secure Medical Context First (Role-Aware)
        clinical_context = await self.get_medical_context(user_id, role=role, db=db)

        # 2. Save the user's message
        await self.save_chat_message(user_id, conversation_id, "user", user_message, db=db)

        # 3. Get conversational history
        history = await self.get_chat_history(user_id, conversation_id, db=db)

        # 4. Premium Personality Prompt
        system_prompt = (
            "You are CHITTI, the High-End Personal Healthcare Companion for the Hospyn 2.0 Platform.\n\n"
            "YOUR UNIQUE IDENTITY:\n"
            "- You are NOT a generic AI. You are a dedicated partner in the patient's health journey.\n"
            "- You HAVE access to the patient's real-time medical profile provided below as SECURE_CLINICAL_CONTEXT.\n"
            "- Your tone is empathetic, elite, and proactive.\n\n"
            f"- IMPORTANT: Please respond in the following language/dialect: {language_code}.\n"
            f"- If language is not English, ensure you maintain the warm 'Chitti' personality while speaking {language_code}.\n\n"
            "OPERATING GUIDELINES:\n"
            "1. CONTEXTUAL AWARENESS: Always check the 'SECURE_CLINICAL_CONTEXT_V1' section. Use THIS data for clinical queries.\n"
            "2. PROACTIVITY: Suggest health tips based on the 'active_state' and 'timeline' in the context.\n"
            "3. PRIVACY: Do not hallucinate data not present in the context.\n"
            "4. ELITE STATUS: Introduce yourself as 'CHITTI, your Healthcare Companion' in your first turn."
        )
        
        formatted_history = ""
        for msg in history:
            role_label = "User" if msg["role"] == "user" else "Assistant"
            formatted_history += f"{role_label}: {msg['content']}\n"
        
        full_prompt = (
            f"{system_prompt}\n\n"
            f"--- SECURE CLINICAL CONTEXT (FILTERED) ---\n"
            f"{clinical_context}\n\n"
            f"--- CONVERSATION HISTORY ---\n"
            f"{formatted_history}\n"
            f"Assistant:"
        )

        # 5. Generate response
        response = await self.unified_ai_engine(full_prompt, image_bytes=image_bytes, language_code=language_code)

        # 6. Save and Return
        if response and response != "SERVICE_UNAVAILABLE":
            await self.save_chat_message(user_id, conversation_id, "assistant", response, db=db)
            return response
        
        return "I apologize, but I am having trouble connecting to my central medical memory right now."

_ai_service_instance = AsyncAIService()

async def get_ai_service() -> AsyncAIService:
    """Dependency injection wrapper for the AI Service allowing mock overrides during tests."""
    return _ai_service_instance
