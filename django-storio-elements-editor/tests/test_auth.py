import json
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client, TestCase, override_settings

from storio_elements_editor import auth
from storio_elements_editor.models import CmsRecord

BASE = "/api/cms"


def only_ana(request):
    return request.user.is_authenticated and request.user.username == "ana"


class TokenAuthTests(TestCase):
    def setUp(self):
        cache.clear()
        User = get_user_model()
        self.staff = User.objects.create_user("editor", password="pw12345", is_staff=True, first_name="Eda", last_name="Tor")
        self.visitor = User.objects.create_user("visitor", password="pw12345")
        # enforce_csrf_checks: prove that a token request needs no CSRF token.
        self.client = Client(enforce_csrf_checks=True)

    def login(self, username="editor", password="pw12345", client=None):
        return (client or self.client).post(
            f"{BASE}/auth/login", data=json.dumps({"username": username, "password": password}), content_type="application/json"
        )

    def token(self):
        return self.login().json()["token"]

    def put(self, token=None, content=None, page="home", section="hero"):
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"} if token else {}
        return self.client.put(
            f"{BASE}/records/{page}/{section}",
            data=json.dumps({"content": content or {"title": "Hi"}, "isPublished": True}),
            content_type="application/json",
            **headers,
        )

    # ------------------------------------------------------------------ login

    def test_login_returns_a_token_and_user(self):
        res = self.login()
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["token"])
        self.assertEqual(body["expiresIn"], 12 * 60 * 60)
        self.assertEqual(body["user"], {"username": "editor", "name": "Eda Tor"})
        self.assertEqual(res["Cache-Control"], "no-store")

    def test_wrong_password_and_unknown_user_look_the_same(self):
        a, b = self.login(password="nope"), self.login(username="ghost")
        self.assertEqual((a.status_code, b.status_code), (401, 401))
        self.assertEqual(a.json(), b.json())

    def test_non_staff_account_is_refused_even_with_the_right_password(self):
        res = self.login(username="visitor")
        self.assertEqual(res.status_code, 403)
        self.assertNotIn("token", res.json())

    def test_inactive_user_cannot_log_in(self):
        self.staff.is_active = False
        self.staff.save()
        self.assertEqual(self.login().status_code, 401)

    def test_bad_requests(self):
        self.assertEqual(self.client.get(f"{BASE}/auth/login").status_code, 405)
        post = lambda body: self.client.post(f"{BASE}/auth/login", data=body, content_type="application/json")
        self.assertEqual(post("not json").status_code, 400)
        self.assertEqual(post(json.dumps({"username": "editor"})).status_code, 400)
        self.assertEqual(post(json.dumps({"username": 1, "password": 2})).status_code, 400)
        self.assertEqual(post(json.dumps(["x"])).status_code, 400)
        self.assertEqual(post(json.dumps({"username": "a", "password": "x" * 5000})).status_code, 413)

    def test_login_can_be_disabled(self):
        with override_settings(STORIO_EDITOR={"TOKEN_LOGIN": False}):
            self.assertEqual(self.login().status_code, 404)

    # ------------------------------------------------------------------ using the token

    def test_token_saves_without_csrf_token_and_records_the_editor(self):
        res = self.put(self.token())
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["updatedBy"], "editor")
        self.assertEqual(CmsRecord.objects.get(page="home", section_key="hero").updated_by, self.staff)

    def test_no_token_and_no_csrf_is_still_refused(self):
        self.assertEqual(self.put().status_code, 403)  # cookie-style request without CSRF token
        self.assertFalse(CmsRecord.objects.exists())

    def test_garbage_or_foreign_tokens_are_refused(self):
        for bad in ("garbage", "a:b:c", self.token()[:-3] + "xyz"):
            self.assertEqual(self.put(bad).status_code, 403, bad)
        self.assertFalse(CmsRecord.objects.exists())

    def test_token_cannot_be_used_after_it_expires(self):
        token = self.token()
        with override_settings(STORIO_EDITOR={"TOKEN_MAX_AGE": -1}):
            auth_client = Client()
            res = auth_client.get(f"{BASE}/auth/me", HTTP_AUTHORIZATION=f"Bearer {token}")
            self.assertEqual(res.status_code, 401)

    def test_changing_the_password_invalidates_old_tokens(self):
        token = self.token()
        self.assertEqual(self.put(token).status_code, 200)
        self.staff.set_password("brand-new-pw")
        self.staff.save()
        self.assertEqual(self.client.get(f"{BASE}/auth/me", HTTP_AUTHORIZATION=f"Bearer {token}").status_code, 401)

    def test_deactivated_or_demoted_users_lose_access(self):
        token = self.token()
        self.staff.is_staff = False
        self.staff.save()
        self.assertEqual(self.client.get(f"{BASE}/auth/me", HTTP_AUTHORIZATION=f"Bearer {token}").status_code, 401)
        self.staff.is_staff, self.staff.is_active = True, False
        self.staff.save()
        self.assertEqual(self.client.get(f"{BASE}/auth/me", HTTP_AUTHORIZATION=f"Bearer {token}").status_code, 401)

    def test_token_unlocks_drafts_delete_and_media_list(self):
        token = self.token()
        h = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        CmsRecord.objects.create(page="home", section_key="hero", content={"t": 1}, is_published=False)
        self.assertEqual(self.client.get(f"{BASE}/records?page=home").json(), [])
        self.assertEqual(len(self.client.get(f"{BASE}/records?page=home&drafts=1", **h).json()), 1)
        self.assertEqual(self.client.get(f"{BASE}/records?page=home&drafts=1").json(), [])  # anonymous: no drafts
        self.assertEqual(self.client.delete(f"{BASE}/records/home/hero", **h).status_code, 204)
        self.assertEqual(self.client.get(f"{BASE}/media", **h).status_code, 200)
        self.assertEqual(self.client.get(f"{BASE}/media").status_code, 401)

    # ------------------------------------------------------------------ me

    def test_me(self):
        self.assertEqual(self.client.get(f"{BASE}/auth/me").status_code, 401)
        res = self.client.get(f"{BASE}/auth/me", HTTP_AUTHORIZATION=f"Bearer {self.token()}")
        self.assertEqual(res.json(), {"user": {"username": "editor", "name": "Eda Tor"}})
        self.assertEqual(self.client.post(f"{BASE}/auth/me").status_code, 405)

    def test_me_also_accepts_a_django_staff_session(self):
        session = Client()
        session.force_login(self.staff)
        self.assertEqual(session.get(f"{BASE}/auth/me").status_code, 200)

    # ------------------------------------------------------------------ custom AUTHORIZE

    def test_custom_authorize_decides_who_gets_a_token(self):
        get_user_model().objects.create_user("ana", password="pw12345")  # not staff
        with override_settings(STORIO_EDITOR={"AUTHORIZE": "tests.test_auth.only_ana"}):
            from storio_elements_editor import conf

            conf._import.cache_clear()
            try:
                self.assertEqual(self.login(username="editor").status_code, 403)  # staff, but not allowed
                ana = self.login(username="ana")
                self.assertEqual(ana.status_code, 200)
                self.assertEqual(self.put(ana.json()["token"]).status_code, 200)
            finally:
                conf._import.cache_clear()

    # ------------------------------------------------------------------ brute force

    def test_lockout_after_too_many_failures_then_success_is_not_possible_until_it_expires(self):
        for _ in range(5):
            self.assertEqual(self.login(password="wrong").status_code, 401)
        locked = self.login()  # even the right password is refused while locked
        self.assertEqual(locked.status_code, 429)
        self.assertEqual(locked["Retry-After"], "300")

    def test_lockout_is_per_username(self):
        for _ in range(5):
            self.login(username="ghost", password="x")
        self.assertEqual(self.login().status_code, 200)

    def test_success_clears_the_failure_count(self):
        for _ in range(4):
            self.login(password="wrong")
        self.assertEqual(self.login().status_code, 200)
        for _ in range(4):
            self.login(password="wrong")
        self.assertEqual(self.login().status_code, 200)

    def test_failures_expire_with_the_lockout_window(self):
        for _ in range(5):
            self.login(password="wrong")
        with mock.patch("storio_elements_editor.auth.cache.get", return_value=0):
            self.assertEqual(self.login().status_code, 200)

    # ------------------------------------------------------------------ helpers

    def test_attach_token_user_is_idempotent_and_leaves_sessions_alone(self):
        request = mock.Mock(META={"HTTP_AUTHORIZATION": "Basic abc"})
        del request._cms_token_user
        self.assertIsNone(auth.attach_token_user(request))
        self.assertIsNone(auth.attach_token_user(request))
