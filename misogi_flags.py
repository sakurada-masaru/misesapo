from enum import Enum


class FlagOrigin(str, Enum):
    AI_SUGGEST = "ai_suggest"
    RULE = "rule"


class FlagState(str, Enum):
    OPEN = "open"
    TRIAGED = "triaged"
    DISMISSED = "dismissed"
    RESOLVED = "resolved"


FIELD_ROLES = {"cleaning", "field", "staff"}
ADMIN_ROLES = {"admin", "ops", "qa"}
AI_ROLES = {"ai"}

DISALLOWED_PATCH_FIELDS = {"type", "origin", "evidence"}


def _normalize_role(role):
    if not role:
        return ""
    return str(role).strip().lower()


def can_suggest(role):
    normalized = _normalize_role(role)
    return normalized in AI_ROLES or normalized in ADMIN_ROLES


def can_list(role):
    normalized = _normalize_role(role)
    return normalized in FIELD_ROLES or normalized in ADMIN_ROLES


def can_patch(role):
    normalized = _normalize_role(role)
    return normalized in ADMIN_ROLES


def has_disallowed_patch_fields(payload):
    if not isinstance(payload, dict):
        return False
    return any(key in payload for key in DISALLOWED_PATCH_FIELDS)


def build_report_flag_pk(unit_id, report_id):
    normalized_unit = _normalize_role(unit_id) or "unit_internal"
    return f"{normalized_unit}#{report_id}"


def is_same_unit(request_unit_id, item_unit_id):
    if not request_unit_id or not item_unit_id:
        return False
    return str(request_unit_id) == str(item_unit_id)
