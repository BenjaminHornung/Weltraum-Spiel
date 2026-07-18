"""Shared sensitive-material classification and streaming-safe redaction."""

import re
from urllib.parse import unquote


REDACTED = "[REDACTED]"
MIN_SECRET_VALUE_LENGTH = 4
_SECRET_NAME_PARTS = frozenset({
    "auth", "authorization", "bearer", "cookie", "credential", "credentials",
    "passwd", "password", "session", "sig", "signature", "secret", "secrets",
    "token", "tokens",
})
_SECRET_NAME_COMPOUNDS = frozenset({
    "accesskey", "accesstoken", "apikey", "authtoken", "clientsecret",
    "privatekey", "secretaccesskey", "xapikey", "xauthtoken",
    "awssecretaccesskey",
})
_URL_WITH_USERINFO = re.compile(
    r"\b[a-z][a-z0-9+.-]*://[^\s/?#]*@", re.IGNORECASE
)
_ASSIGNMENT = re.compile(
    r"(^|[\s,;])([A-Za-z_][A-Za-z0-9_.-]*)\s*([=:])\s*([^\s,;]+)",
    re.IGNORECASE,
)
_SECRET_OPTION = re.compile(
    r"(^|[\s,;])((?:--?|/)[A-Za-z][A-Za-z0-9_.-]*)(=|\s+)([^\s,;]+)",
    re.IGNORECASE,
)
_HEADER_SECRET = re.compile(
    r"((?:proxy[-_ ]?)?authorization|x[-_ ]?api[-_ ]?key|x[-_ ]?auth[-_ ]?token)"
    r"\s*([:=])\s*((?:basic|bearer)\s+)?([^\s,;]+)",
    re.IGNORECASE,
)
_QUERY_PARAMETER = re.compile(r"([?&;])([^=&;\s]+)=([^&;\s]*)")
_URL_USERINFO_REDACTION = re.compile(
    r"(\b[a-z][a-z0-9+.-]*://)[^\s/?#]*@", re.IGNORECASE
)
_KNOWN_TOKEN = re.compile(
    r"(?<![A-Za-z0-9])(?:"
    r"gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|"
    r"npm_[A-Za-z0-9]{20,}|glpat-[A-Za-z0-9_-]{20,}|"
    r"xox[baprs]-[A-Za-z0-9-]{10,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|"
    r"pypi-[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{20,}"
    r")(?![A-Za-z0-9])",
    re.IGNORECASE,
)


def is_secret_name(name: str) -> bool:
    decoded = _percent_decode(str(name)).strip().lstrip("-/")
    parts = re.findall(r"[a-z0-9]+", decoded.lower())
    if not parts:
        return False
    return bool(_SECRET_NAME_PARTS.intersection(parts)) or "".join(parts) in _SECRET_NAME_COMPOUNDS


def contains_secret_material(value: str, *, ignore_redacted: bool = False) -> bool:
    decoded = _percent_decode(str(value))
    if any(
        not ignore_redacted or REDACTED not in match.group(0)
        for match in _URL_WITH_USERINFO.finditer(decoded)
    ) or _KNOWN_TOKEN.search(decoded):
        return True
    if any(
        not ignore_redacted or match.group(4) != REDACTED
        for match in _HEADER_SECRET.finditer(decoded)
    ):
        return True
    if any(
        is_secret_name(match.group(2))
        and (not ignore_redacted or match.group(4) != REDACTED)
        for match in _SECRET_OPTION.finditer(decoded)
    ):
        return True
    if any(
        is_secret_name(match.group(2))
        and (not ignore_redacted or match.group(3) != REDACTED)
        for match in _QUERY_PARAMETER.finditer(decoded)
    ):
        return True
    return any(
        is_secret_name(match.group(2))
        and (not ignore_redacted or match.group(4) != REDACTED)
        for match in _ASSIGNMENT.finditer(decoded)
    )


def _percent_decode(value: str) -> str:
    decoded = value
    for _ in range(3):
        try:
            next_value = unquote(decoded, errors="strict")
        except UnicodeDecodeError:
            return decoded
        if next_value == decoded:
            break
        decoded = next_value
    return decoded


class Redactor:
    def __init__(
        self,
        environment: dict[str, str],
        explicit_secret_values=(),
    ):
        explicit_values = {str(value) for value in explicit_secret_values if str(value)}
        if any(len(value) < MIN_SECRET_VALUE_LENGTH for value in explicit_values):
            raise ValueError(
                "host environment reference value shorter than four characters cannot be safely redacted"
            )
        short_names = [
            str(name)
            for name, value in environment.items()
            if is_secret_name(str(name)) and str(value) and len(str(value)) < MIN_SECRET_VALUE_LENGTH
        ]
        if short_names:
            raise ValueError(
                "secret values shorter than four characters cannot be safely value-redacted: "
                + ", ".join(sorted(short_names))
            )
        values = {
            str(value)
            for name, value in environment.items()
            if is_secret_name(str(name)) and str(value)
        }
        values.update(explicit_values)
        self._secret_values = sorted(values, key=len, reverse=True)

    def redact(self, value: str) -> str:
        redacted = value
        for secret in self._secret_values:
            redacted = redacted.replace(secret, REDACTED)
        redacted = _KNOWN_TOKEN.sub(REDACTED, redacted)
        redacted = _HEADER_SECRET.sub(
            lambda match: (
                match.group(1) + match.group(2) + " "
                + (match.group(3) or "") + REDACTED
            ),
            redacted,
        )
        redacted = _URL_USERINFO_REDACTION.sub(
            lambda match: match.group(1) + REDACTED + "@", redacted
        )
        redacted = _QUERY_PARAMETER.sub(
            lambda match: (
                match.group(1) + match.group(2) + "="
                + (REDACTED if is_secret_name(match.group(2)) else match.group(3))
            ),
            redacted,
        )
        redacted = _SECRET_OPTION.sub(
            lambda match: (
                match.group(1) + match.group(2) + match.group(3)
                + (REDACTED if is_secret_name(match.group(2)) else match.group(4))
            ),
            redacted,
        )
        redacted = _ASSIGNMENT.sub(
            lambda match: (
                match.group(1) + match.group(2) + match.group(3)
                + (REDACTED if is_secret_name(match.group(2)) else match.group(4))
            ),
            redacted,
        )
        if contains_secret_material(redacted, ignore_redacted=True):
            if redacted.endswith("\r\n"):
                return REDACTED + "\r\n"
            if redacted.endswith(("\n", "\r")):
                return REDACTED + redacted[-1]
            return REDACTED
        return redacted
