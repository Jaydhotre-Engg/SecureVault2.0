import logging

from sqlalchemy import Engine, inspect, text


logger = logging.getLogger("securevault.migrations")


def run_migrations(engine: Engine) -> None:
    """
    Run safe, idempotent SQLite schema migrations.

    Existing data is preserved.
    """

    inspector = inspect(engine)

    # ---------------------------------------------------------
    # 1. Evidence table
    # ---------------------------------------------------------

    if "evidence" in inspector.get_table_names():

        evidence_columns = {
            column["name"]
            for column in inspector.get_columns("evidence")
        }

        if "uploaded_by" not in evidence_columns:

            logger.info(
                "Migrating evidence table: adding uploaded_by"
            )

            with engine.begin() as conn:
                conn.execute(
                    text(
                        """
                        ALTER TABLE evidence
                        ADD COLUMN uploaded_by INTEGER
                        """
                    )
                )

        if "case_id" not in evidence_columns:

            logger.info(
                "Migrating evidence table: adding case_id"
            )

            with engine.begin() as conn:
                conn.execute(
                    text(
                        """
                        ALTER TABLE evidence
                        ADD COLUMN case_id INTEGER
                        """
                    )
                )

            logger.info(
                "Migration completed: case_id added"
            )

    else:

        logger.info(
            "Evidence table does not exist yet. "
            "SQLAlchemy will create it."
        )