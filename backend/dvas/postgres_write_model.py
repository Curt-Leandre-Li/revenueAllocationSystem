import json
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from .contracts import stable_checksum
from .postgres_read_model import PsqlJsonClient, SAFE_ID_RE


AMOUNT_PLACES = Decimal("0.01")
WEIGHT_PLACES = Decimal("0.000001")


def sql_text(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def sql_safe_id(value, field_name="id"):
    if value is None or not SAFE_ID_RE.match(str(value)):
        from .contracts import ApiError

        raise ApiError("DVAS_INPUT_FORMAT_ERROR", f"{field_name} 含有非法字符", status=400)
    return sql_text(value)


def sql_json(value):
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return f"{sql_text(payload)}::jsonb"


def sql_bool(value):
    return "TRUE" if bool(value) else "FALSE"


def sql_int(value):
    return str(int(value))


def as_decimal(value, field_name="amount"):
    from .contracts import ApiError

    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ApiError(
            "DVAS_INPUT_FORMAT_ERROR",
            f"{field_name} 必须是合法数字",
            status=400,
            field_errors=[{"field": field_name, "reason": "必须是合法数字"}],
        ) from exc
    return parsed


def quantize_amount(value):
    return as_decimal(value).quantize(AMOUNT_PLACES, rounding=ROUND_HALF_UP)


def quantize_weight(value):
    return as_decimal(value).quantize(WEIGHT_PLACES, rounding=ROUND_HALF_UP)


def sql_amount(value):
    return str(quantize_amount(value))


def sql_weight(value):
    return str(quantize_weight(value))


def checksum_json(value):
    return stable_checksum(value)


class PostgresWriteModel:
    def __init__(self, client=None):
        self.client = client or PsqlJsonClient()

    def query_json(self, sql):
        return self.client.query_json(sql)

    def execute_json(self, statements, result_sql):
        sql = "\n".join(
            [
                "BEGIN;",
                *[statement.rstrip(";") + ";" for statement in statements],
                "COMMIT;",
                result_sql.strip().rstrip(";") + ";",
            ]
        )
        return self.client.query_json(sql)
