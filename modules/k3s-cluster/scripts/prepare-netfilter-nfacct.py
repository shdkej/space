#!/usr/bin/env python3
"""Prepare only kube-proxy accounting objects referenced by persistent rules.

Default mode is read-only. --ensure creates missing non-quota objects before
netfilter-persistent restores rules. Existing objects and counters are preserved.
This utility never saves/restores rules, deletes objects, or resets counters.
"""
import argparse
import errno
import json
import os
from pathlib import Path
import shlex
import socket
import struct
import sys

ALLOWED_NAMES = frozenset(("ct_state_invalid_dropped_pkts", "localhost_nps_accepted_pkts"))
NETLINK_NETFILTER = 12
NFNL_SUBSYS_ACCT = 7
REQUEST_ACK = 0x01 | 0x04
CREATE_EXCLUSIVE = 0x400 | 0x200


def required_names(directory):
    names = set()
    for filename in ("rules.v4", "rules.v6"):
        path = directory / filename
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            if not line.startswith("-A ") or "--nfacct-name" not in line:
                continue
            tokens = shlex.split(line)
            for position, token in enumerate(tokens):
                if token == "--nfacct-name":
                    if position + 1 == len(tokens) or tokens[position + 1] not in ALLOWED_NAMES:
                        raise ValueError("Unsupported accounting reference; review persistent rules manually")
                    names.add(tokens[position + 1])
    return sorted(names)


def request(command, name, extra_flags=0):
    """NFNL ACCT GET/NEW with an ACK; no replacement or counter reset flags."""
    encoded = name.encode("ascii") + b"\0"
    attribute = struct.pack("=HH", len(encoded) + 4, 1) + encoded
    attribute += b"\0" * (-len(attribute) % 4)
    payload = struct.pack("!BBH", socket.AF_UNSPEC, 0, 0) + attribute
    message = struct.pack("=IHHII", 16 + len(payload),
                          (NFNL_SUBSYS_ACCT << 8) | command,
                          REQUEST_ACK | extra_flags, 1, 0) + payload
    replies = []
    with socket.socket(socket.AF_NETLINK, socket.SOCK_RAW, NETLINK_NETFILTER) as sock:
        sock.settimeout(3)
        sock.bind((0, 0))
        sock.sendto(message, (0, 0))
        while True:
            packet, sender = sock.recvfrom(65536)
            if sender[0] != 0:
                raise RuntimeError("Unexpected netlink sender")
            offset = 0
            while offset < len(packet):
                if len(packet) - offset < 16:
                    raise RuntimeError("Truncated netlink header")
                length, kind, _flags, sequence, _pid = struct.unpack_from("=IHHII", packet, offset)
                if length < 16 or offset + length > len(packet) or sequence != 1:
                    raise RuntimeError("Malformed netlink response")
                data = packet[offset + 16:offset + length]
                if kind == 2:  # NLMSG_ERROR carries success ACK (0) or negative errno.
                    if len(data) < 4:
                        raise RuntimeError("Truncated netlink acknowledgement")
                    error = struct.unpack_from("=i", data)[0]
                    if error:
                        raise OSError(-error, os.strerror(-error))
                    return replies
                if kind != (NFNL_SUBSYS_ACCT << 8):
                    raise RuntimeError("Unexpected netlink message type")
                replies.append(data)
                offset += (length + 3) & ~3


def get_counter(name):
    try:
        replies = request(1, name)  # GET, never GET_CTRZERO.
    except OSError as error:
        if error.errno == errno.ENOENT:
            return None
        raise
    if len(replies) != 1 or len(replies[0]) < 4:
        raise RuntimeError("Invalid accounting response")
    data = replies[0]
    attributes = {}
    offset = 4  # nfgenmsg
    while offset < len(data):
        if len(data) - offset < 4:
            raise RuntimeError("Truncated accounting attribute")
        length, kind = struct.unpack_from("=HH", data, offset)
        if length < 4 or offset + length > len(data):
            raise RuntimeError("Malformed accounting attribute")
        attributes[kind & 0x3FFF] = data[offset + 4:offset + length]
        offset += (length + 3) & ~3
    if attributes.get(1) != name.encode("ascii") + b"\0":
        raise RuntimeError("Accounting object name mismatch")
    if len(attributes.get(2, b"")) != 8 or len(attributes.get(3, b"")) != 8:
        raise RuntimeError("Missing accounting counters")
    if int.from_bytes(attributes.get(5, b"\0"), "big") or 6 in attributes:
        raise ValueError("Quota accounting object found; refusing to change it")
    return {"packets": int.from_bytes(attributes[2], "big"),
            "bytes": int.from_bytes(attributes[3], "big")}


def prepare(names, ensure=False):
    if not set(names).issubset(ALLOWED_NAMES):
        raise ValueError("Unsupported accounting object")
    # Validate every existing object before creating any missing object.
    initial = {name: get_counter(name) for name in names}
    missing = [name for name, counter in initial.items() if counter is None]
    created = 0
    if ensure:
        for name in missing:
            try:
                request(0, name, CREATE_EXCLUSIVE)
                created += 1
            except OSError as error:
                # kube-proxy can create the same object concurrently. Never replace it.
                if error.errno not in (errno.EEXIST, errno.EBUSY):
                    raise
            if get_counter(name) is None:
                raise RuntimeError("Accounting object absent after creation")
    return {"required": len(names), "created": created,
            "existing": len(names) - len(missing), "missing": 0 if ensure else len(missing)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="read-only preflight (default)")
    mode.add_argument("--ensure", action="store_true", help="create missing non-quota objects only")
    parser.add_argument("--rules-dir", type=Path, default=Path("/etc/iptables"))
    args = parser.parse_args()
    result = prepare(required_names(args.rules_dir), ensure=args.ensure)
    print(json.dumps({"mode": "ensure" if args.ensure else "check", **result}, sort_keys=True))
    return 1 if result["missing"] else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, RuntimeError, ValueError) as error:
        print(f"netfilter accounting preparation failed: {error}", file=sys.stderr)
        sys.exit(1)
