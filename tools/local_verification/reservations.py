"""Atomic filesystem-backed reservations."""
import hashlib
import json
import os
from pathlib import Path

from .process_control import get_process_identity

class ReservationConflict(RuntimeError): pass

def _safe(value):
    return "".join(c if c.isalnum() else "-" for c in value)[:32] + "-" + hashlib.sha256(value.encode()).hexdigest()[:16]

class Reservations:
    def __init__(self, state_directory, run_id, owner_pid=None, process_identity=None):
        self.root, self.run_id, self._held = Path(state_directory) / "reservations", run_id, []
        self.owner_pid = os.getpid() if owner_pid is None else owner_pid
        self.process_identity = process_identity or get_process_identity(self.owner_pid)
        if not self.process_identity:
            raise RuntimeError("owner process identity could not be corroborated")
    def _claim(self, name):
        path = self.root / _safe(name); self.root.mkdir(parents=True, exist_ok=True)
        try: path.mkdir()
        except FileExistsError: return False
        try:
            owner = {
                "run_id": self.run_id,
                "owner_pid": self.owner_pid,
                "process_identity": self.process_identity,
                "resource": name,
            }
            temporary = path / "owner.json.tmp"
            temporary.write_text(json.dumps(owner, sort_keys=True), encoding="utf-8")
            os.replace(temporary, path / "owner.json")
        except BaseException:
            try:
                (path / "owner.json.tmp").unlink()
            except FileNotFoundError:
                pass
            path.rmdir()
            raise
        self._held.append(path); return True
    def claim(self, name):
        if not self._claim(name): raise ReservationConflict(f"resource already reserved: {name}")
    def claim_slot(self, name, capacity):
        if capacity < 1: raise ValueError(f"invalid capacity for {name}: {capacity}")
        if not any(self._claim(f"{name}:slot:{slot}") for slot in range(capacity)):
            raise ReservationConflict(f"no reservation slot available: {name}")
    def release_all(self):
        for path in reversed(self._held):
            try:
                owner = path / "owner.json"
                if json.loads(owner.read_text(encoding="utf-8")).get("run_id") != self.run_id: continue
                owner.unlink(); path.rmdir()
            except FileNotFoundError: pass
        self._held.clear()
