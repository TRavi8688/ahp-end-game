"""Schema audit utility
Generates a JSON report comparing SQLAlchemy model metadata with the live PostgreSQL schema.

Usage:
    python scripts/schema_audit.py

The script expects the DATABASE_URL environment variable to be set.
"""
import os
import json
from pathlib import Path
from sqlalchemy import create_engine, MetaData
from app.models.core import Base  # Base aggregates all model tables

def load_model_metadata() -> MetaData:
    return Base.metadata

def reflect_db_metadata(engine) -> MetaData:
    db_meta = MetaData()
    db_meta.reflect(bind=engine)
    return db_meta

def compare_metadata(model_meta: MetaData, db_meta: MetaData):
    report = {
        "missing_tables": [],
        "extra_tables": [],
        "missing_columns": [],
        "extra_columns": [],
        "type_mismatches": [],
        "nullability_mismatches": [],
        "default_mismatches": [],
    }
    # Table level
    model_tables = set(model_meta.tables.keys())
    db_tables = set(db_meta.tables.keys())
    report["missing_tables"] = list(model_tables - db_tables)
    report["extra_tables"] = list(db_tables - model_tables)
    # Column level
    for tbl_name, tbl in model_meta.tables.items():
        if tbl_name not in db_meta.tables:
            continue
        db_tbl = db_meta.tables[tbl_name]
        model_cols = set(tbl.columns.keys())
        db_cols = set(db_tbl.columns.keys())
        for col_name in model_cols - db_cols:
            report["missing_columns"].append(f"{tbl_name}.{col_name}")
        for col_name in db_cols - model_cols:
            report["extra_columns"].append(f"{tbl_name}.{col_name}")
        for col_name, col in tbl.columns.items():
            if col_name not in db_tbl.columns:
                continue
            db_col = db_tbl.columns[col_name]
            if type(col.type) != type(db_col.type):
                report["type_mismatches"].append(f"{tbl_name}.{col_name}: {col.type} vs {db_col.type}")
            if col.nullable != db_col.nullable:
                report["nullability_mismatches"].append(f"{tbl_name}.{col_name}: nullable={col.nullable} vs {db_col.nullable}")
            # Compare defaults (simple string representation)
            model_def = getattr(col.default, "arg", None)
            db_def = getattr(db_col.default, "arg", None)
            if model_def != db_def:
                report["default_mismatches"].append(f"{tbl_name}.{col_name}: default={model_def} vs {db_def}")
    return report

def main():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable not set")
    engine = create_engine(database_url)
    model_meta = load_model_metadata()
    db_meta = reflect_db_metadata(engine)
    report = compare_metadata(model_meta, db_meta)
    out_path = Path("schema_audit_report.json")
    out_path.write_text(json.dumps(report, indent=2))
    print(f"Schema audit completed. Report written to {out_path}")

if __name__ == "__main__":
    main()
