"""
InsForge Database Client - Drop-in replacement for supabase-py

API findings:
- GET    /api/database/records/{table}           -> list/filter records
- POST   /api/database/records/{table}           -> insert record
- PATCH  /api/database/records/{table}?filters   -> update records
- DELETE /api/database/records/{table}?filters   -> delete records

Filter format (PostgREST style):
  ?email=eq.user@example.com
  ?revoked_at=is.null
  ?patient_id=in.(1,2,3)

Response format:
  { "value": [...], "Count": N }

Reserved fields (auto-managed by InsForge): id, created_at, updated_at
The `id` field is a UUID string.
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

INSFORGE_URL = os.getenv("INSFORGE_URL")
INSFORGE_KEY = os.getenv("INSFORGE_KEY")

if not INSFORGE_URL or not INSFORGE_KEY:
    raise ValueError("Missing INSFORGE_URL or INSFORGE_KEY in environment variables")


class InsForgeResult:
    """Mimics supabase-py APIResponse with .data and .count attributes."""
    def __init__(self, data=None, count=None, error=None):
        self.data = data if data is not None else []
        self.count = count
        self.error = error

    def __repr__(self):
        return f"InsForgeResult(data={self.data!r}, count={self.count}, error={self.error!r})"


class InsForgeQueryBuilder:
    """
    Chainable query builder that mirrors the supabase-py table query interface.
    Converts method chains into InsForge REST API requests.
    """

    def __init__(self, base_url, headers, table_name):
        self._base_url = base_url.rstrip("/")
        self._headers = headers
        self._table = table_name
        self._eq_filters = {}        # column -> value (eq filter)
        self._ilike_filters = {}     # column -> value (ilike filter)
        self._like_filters = {}      # column -> value (like filter)
        self._is_null_filters = {}   # column -> 'null' or 'not.null'
        self._in_filters = {}        # column -> [values]
        self._order_col = None
        self._order_desc = False
        self._limit_val = None
        self._count_mode = None
        self._operation = None
        self._payload = None

    # --- Query Spec ---

    def select(self, columns="*", count=None):
        self._count_mode = count
        self._operation = "select"
        return self

    def insert(self, data):
        self._operation = "insert"
        self._payload = data if isinstance(data, list) else [data]
        return self

    def update(self, data):
        self._operation = "update"
        self._payload = data
        return self

    def delete(self):
        self._operation = "delete"
        return self

    def eq(self, column, value):
        self._eq_filters[column] = value
        return self

    def ilike(self, column, value):
        self._ilike_filters[column] = value
        return self

    def like(self, column, value):
        self._like_filters[column] = value
        return self

    def is_(self, column, value):
        # value='null' means IS NULL, value='not.null' means IS NOT NULL
        self._is_null_filters[column] = value
        return self

    def in_(self, column, values):
        self._in_filters[column] = values
        return self

    def order(self, column, desc=False):
        self._order_col = column
        self._order_desc = desc
        return self

    def limit(self, n):
        self._limit_val = n
        return self

    # --- Execution ---

    def execute(self):
        url = f"{self._base_url}/api/database/records/{self._table}"
        try:
            if self._operation == "select":
                return self._execute_select(url)
            elif self._operation == "insert":
                return self._execute_insert(url)
            elif self._operation == "update":
                return self._execute_update(url)
            elif self._operation == "delete":
                return self._execute_delete(url)
            else:
                return InsForgeResult(error="No operation specified")
        except Exception as e:
            print(f"[InsForge Error] {self._table}.{self._operation}: {e}")
            return InsForgeResult(error=str(e))

    def _build_filter_params(self):
        """Build PostgREST-style filter query params."""
        params = []
        for col, val in self._eq_filters.items():
            params.append((col, f"eq.{val}"))
        for col, val in self._ilike_filters.items():
            params.append((col, f"ilike.{val}"))
        for col, val in self._like_filters.items():
            params.append((col, f"like.{val}"))
        for col, val in self._is_null_filters.items():
            params.append((col, f"is.{val}"))
        for col, vals in self._in_filters.items():
            in_list = ",".join(str(v) for v in vals)
            params.append((col, f"in.({in_list})"))
        if self._order_col:
            direction = "desc" if self._order_desc else "asc"
            params.append(("order", f"{self._order_col}.{direction}"))
        if self._limit_val is not None:
            params.append(("limit", str(self._limit_val)))
        return params

    def _parse_response(self, resp):
        """Parse InsForge response: { value: [...], Count: N }"""
        if resp.status_code in (200, 201):
            try:
                raw = resp.json()
                if isinstance(raw, dict):
                    # InsForge standard response format
                    data = raw.get("value", raw.get("data", raw.get("records", [])))
                    count = raw.get("Count", raw.get("total", raw.get("count", None)))
                    # If a single object was returned (insert response)
                    if not isinstance(data, list):
                        data = [data] if data else []
                    return InsForgeResult(data=data, count=count)
                elif isinstance(raw, list):
                    return InsForgeResult(data=raw, count=len(raw))
                else:
                    return InsForgeResult(data=[], count=0)
            except Exception as e:
                print(f"[InsForge Parse Error] {self._table}: {e}")
                return InsForgeResult(data=[])
        elif resp.status_code == 204:
            return InsForgeResult(data=[])
        else:
            print(f"[InsForge API Error] {self._table} {self._operation}: {resp.status_code} {resp.text[:250]}")
            return InsForgeResult(data=[], error=resp.text)

    def _execute_select(self, url):
        params = self._build_filter_params()
        resp = requests.get(url, headers=self._headers, params=params)
        result = self._parse_response(resp)
        count = result.count if self._count_mode == "exact" else None
        return InsForgeResult(data=result.data, count=count)

    def _execute_insert(self, url):
        records = self._payload or []
        all_inserted = []
        for record in records:
            resp = requests.post(url, headers=self._headers, json=record)
            if resp.status_code in (200, 201):
                # InsForge returns [] on inserts - fetch the record back by unique fields
                inserted = self._fetch_after_insert(url, record)
                if inserted:
                    all_inserted.append(inserted)
            else:
                print(f"[InsForge INSERT Error] {self._table}: {resp.status_code} {resp.text[:200]}")
                return InsForgeResult(data=all_inserted, error=resp.text)
        return InsForgeResult(data=all_inserted)

    def _fetch_after_insert(self, url, record):
        """Fetch the just-inserted record back from the DB by matching unique fields."""
        # Priority: try unique-ish fields to find the inserted record
        priority_keys = ["email", "hospyn_id", "access_token", "phone_number",
                         "license_number", "connect_id", "allergen", "generic_name"]
        params = []
        for k in priority_keys:
            if k in record and record[k] is not None:
                params = [(k, f"eq.{record[k]}")]
                break
        if not params:
            # Fall back: order by created_at desc, get latest
            params = [("order", "created_at.desc"), ("limit", "1")]

        try:
            resp = requests.get(url, headers=self._headers, params=params)
            if resp.status_code == 200:
                raw = resp.json()
                data = raw.get("value", raw) if isinstance(raw, dict) else raw
                if isinstance(data, list) and data:
                    return data[0]
        except Exception as e:
            print(f"[InsForge Fetch-After-Insert Error] {self._table}: {e}")
        return None



    def _execute_update(self, url):
        params = self._build_filter_params()
        resp = requests.patch(url, headers=self._headers, json=self._payload, params=params)
        return self._parse_response(resp)

    def _execute_delete(self, url):
        params = self._build_filter_params()
        resp = requests.delete(url, headers=self._headers, params=params)
        if resp.status_code in (200, 204):
            return InsForgeResult(data=[])
        return self._parse_response(resp)


class InsForgeClient:
    """
    Drop-in replacement for supabase.Client.
    Usage: client.table('users').select('*').eq('email', val).execute()
    Returns InsForgeResult with .data (list) and .count (int|None)
    """

    def __init__(self, url, key):
        self._url = url.rstrip("/")
        self._headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    def table(self, table_name: str) -> InsForgeQueryBuilder:
        return InsForgeQueryBuilder(self._url, self._headers, table_name)


# Singleton InsForge client instance
insforge: InsForgeClient = InsForgeClient(INSFORGE_URL, INSFORGE_KEY)


def get_db():
    """FastAPI dependency injection — yields the InsForge client."""
    try:
        yield insforge
    finally:
        pass
