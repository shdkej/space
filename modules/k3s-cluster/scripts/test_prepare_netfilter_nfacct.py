#!/usr/bin/env python3
"""Root-only regression checks; every mutation stays in a fresh network namespace."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import unittest

HELPER = Path(__file__).with_name("prepare-netfilter-nfacct.py")


def fingerprint():
    result = {}
    for command in ("iptables-save", "ip6tables-save"):
        raw = subprocess.check_output([command], text=True)
        stable = "\n".join(line for line in raw.splitlines() if not line.startswith("#"))
        stable = re.sub(r"\[\d+:\d+\]", "[0:0]", stable)
        result[command] = hashlib.sha256(stable.encode()).hexdigest()
    return result


class IsolatedRegression(unittest.TestCase):
    def isolated(self, body):
        before = fingerprint()
        wrapper = """
import importlib.util, json, os, pathlib, subprocess, sys, tempfile
sys.dont_write_bytecode = True
assert os.readlink('/proc/self/ns/net') != sys.argv[2], 'host namespace must never be used'
path = pathlib.Path(sys.argv[1])
spec = importlib.util.spec_from_file_location('nfacct_helper', path)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
"""
        result = subprocess.run(
            ["unshare", "--net", "--", "python3", "-c", wrapper + body,
             str(HELPER), os.readlink("/proc/self/ns/net")],
            capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(before, fingerprint(), "host firewall policy changed")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_missing_accounting_objects_are_created_without_resetting_existing_ones(self):
        self.isolated("""
names = helper.required_names(pathlib.Path('/etc/iptables'))
assert len(names) == 2
assert all(helper.get_counter(name) is None for name in names)
first = helper.prepare(names, ensure=True)
assert first == {'required': 2, 'created': 2, 'existing': 0, 'missing': 0}
before = {name: helper.get_counter(name) for name in names}
import socket
subprocess.run(['ip', 'link', 'set', 'lo', 'up'], check=True)
subprocess.run(['iptables', '--modprobe=/bin/false', '-A', 'OUTPUT', '-o', 'lo',
                '-m', 'nfacct', '--nfacct-name', names[0], '-j', 'ACCEPT'], check=True)
with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as traffic:
    traffic.sendto(b'counter-preservation-test', ('127.0.0.1', 9))
before = {name: helper.get_counter(name) for name in names}
assert before[names[0]]['packets'] > 0 and before[names[0]]['bytes'] > 0
second = helper.prepare(names, ensure=True)
assert second == {'required': 2, 'created': 0, 'existing': 2, 'missing': 0}
assert before == {name: helper.get_counter(name) for name in names}
""")

    def test_check_does_not_create_objects(self):
        self.isolated("""
names = helper.required_names(pathlib.Path('/etc/iptables'))
result = helper.prepare(names, ensure=False)
assert result['missing'] == 2 and result['created'] == 0
assert all(helper.get_counter(name) is None for name in names)
""")

    def test_original_complete_rules_restore_after_prepare(self):
        self.isolated("""
import shlex
def policy(raw):
    tables = {}; current = None
    for line in raw.splitlines():
        if line.startswith('*'):
            current = tables.setdefault(line[1:], {'chains': {}, 'rules': {}})
        elif line.startswith(':'):
            parts = line.split()
            current['chains'][parts[0][1:]] = parts[1]
        elif line.startswith('-A '):
            tokens = shlex.split(line)
            current['rules'].setdefault(tokens[1], []).append(tokens[2:])
    return tables
names = helper.required_names(pathlib.Path('/etc/iptables'))
helper.prepare(names, ensure=True)
for restore, save, suffix in [('iptables-restore', 'iptables-save', 'v4'),
                              ('ip6tables-restore', 'ip6tables-save', 'v6')]:
    original = pathlib.Path('/etc/iptables/rules.' + suffix).read_text()
    result = subprocess.run([restore, '--modprobe=/bin/false', '--noflush'],
                            input=original, text=True, capture_output=True)
    assert result.returncode == 0, restore + ' failed (details intentionally withheld)'
    restored = subprocess.check_output([save], text=True)
    assert policy(original) == policy(restored), 'restored policy differs'
""")

    def test_unknown_counter_reference_is_rejected_before_any_mutation(self):
        self.isolated("""
with tempfile.TemporaryDirectory(prefix='nfacct-fixture-') as directory:
    root = pathlib.Path(directory)
    (root / 'rules.v4').write_text('*filter\\n-A INPUT -m nfacct --nfacct-name unknown -j ACCEPT\\nCOMMIT\\n')
    try:
        helper.required_names(root)
    except ValueError:
        pass
    else:
        raise AssertionError('unknown counter accepted')
    assert helper.get_counter('unknown') is None
""")


if __name__ == "__main__":
    if os.geteuid() != 0:
        raise SystemExit("Run with sudo; namespace creation requires CAP_SYS_ADMIN.")
    unittest.main()
