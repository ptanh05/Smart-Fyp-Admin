"""
Security regression tests added in second audit pass (Nov 2026).

Covers:
  F14 – Admin settings.py fail-closed guard: ImproperlyConfigured when
        SECRET_KEY is insecure in production (DEBUG=False).
"""

import os
from django.test import TestCase
from django.conf import settings


class AdminProductionKeyGuardTest(TestCase):
    """
    F14 (HIGH): When DEBUG=False and SECRET_KEY starts with 'django-insecure-',
    Django settings must raise ImproperlyConfigured.
    """

    def test_insecure_key_guard_present_in_settings_source(self):
        """F14: settings.py must contain the ImproperlyConfigured guard."""
        settings_path = os.path.join(
            os.path.dirname(__file__), '..', '..', 'backend', 'settings.py'
        )
        with open(settings_path, encoding='utf-8') as fh:
            src = fh.read()
        self.assertIn(
            'ImproperlyConfigured',
            src,
            "F14 (HIGH): Admin settings.py must raise ImproperlyConfigured when "
            "SECRET_KEY is insecure in production."
        )
        self.assertIn(
            'django-insecure-',
            src,
            "F14: settings.py must check for 'django-insecure-' prefix on SECRET_KEY"
        )

    def test_no_wildcard_in_allowed_hosts(self):
        """F13 (regression): ALLOWED_HOSTS must not contain '*'."""
        self.assertNotIn(
            '*', settings.ALLOWED_HOSTS,
            "ALLOWED_HOSTS must not contain wildcard '*' (F13)"
        )
