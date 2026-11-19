import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings

BASE = "/api/cms/collections"

# Django's User model stands in for a blog post or product table.
PEOPLE = {
    "people": {
        "model": "auth.User",
        "lookup": "username",
        "label": "first_name",
        "fields": ["first_name", "last_name", "is_active"],
        "on_save": "tests.test_collections.remember_save",
    }
}
SAVED = []


def remember_save(obj, request):
    SAVED.append(obj.username)


def only_active(request):
    return get_user_model().objects.filter(is_active=True)


@override_settings(STORIO_EDITOR={"COLLECTIONS": PEOPLE})
class CollectionTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.staff = User.objects.create_user("editor", password="pw", is_staff=True, first_name="Eda")
        User.objects.create_user("school", password="pw", first_name="School", last_name="Post")
        self.editor = Client()
        self.editor.force_login(self.staff)
        self.anon = Client()
        SAVED.clear()

    def put(self, client, item, values):
        return client.put(f"{BASE}/people/items/{item}", data=json.dumps({"values": values}), content_type="application/json")

    def test_lists_and_reads_records_for_editors_only(self):
        res = self.editor.get(f"{BASE}/people/items")
        self.assertEqual(res.status_code, 200)
        self.assertIn({"id": "school", "label": "School"}, res.json())
        self.assertEqual(
            self.editor.get(f"{BASE}/people/items/school").json(),
            {"first_name": "School", "last_name": "Post", "is_active": True},
        )
        self.assertEqual(self.anon.get(f"{BASE}/people/items").status_code, 401)
        self.assertEqual(self.anon.get(f"{BASE}/people/items/school").status_code, 401)

    def test_saves_only_the_configured_fields(self):
        res = self.put(self.editor, "school", {"first_name": "Schools"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["first_name"], "Schools")
        self.assertEqual(get_user_model().objects.get(username="school").first_name, "Schools")
        self.assertEqual(SAVED, ["school"])

        res = self.put(self.editor, "school", {"is_staff": True})
        self.assertEqual(res.status_code, 400)
        self.assertFalse(get_user_model().objects.get(username="school").is_staff)

    def test_rejects_invalid_values_and_anonymous_writes(self):
        res = self.put(self.editor, "school", {"first_name": "x" * 500})
        self.assertEqual(res.status_code, 400)
        self.assertIn("first_name", res.json()["errors"])
        self.assertEqual(self.put(self.anon, "school", {"first_name": "Hacked"}).status_code, 401)
        self.assertEqual(get_user_model().objects.get(username="school").first_name, "School")

    def test_unknown_collection_and_record(self):
        self.assertEqual(self.editor.get(f"{BASE}/nope/items").status_code, 404)
        self.assertEqual(self.editor.get(f"{BASE}/people/items/missing").status_code, 404)

    def test_queryset_limits_what_can_be_opened(self):
        get_user_model().objects.filter(username="school").update(is_active=False)
        config = {"people": {**PEOPLE["people"], "queryset": "tests.test_collections.only_active"}}
        with override_settings(STORIO_EDITOR={"COLLECTIONS": config}):
            self.assertEqual(self.editor.get(f"{BASE}/people/items/school").status_code, 404)
            self.assertNotIn("school", [i["id"] for i in self.editor.get(f"{BASE}/people/items").json()])

    def test_explains_a_wrong_configuration(self):
        config = {"people": {**PEOPLE["people"], "fields": ["groups"]}}
        with override_settings(STORIO_EDITOR={"COLLECTIONS": config}):
            res = self.editor.get(f"{BASE}/people/items")
            self.assertEqual(res.status_code, 500)
            self.assertIn("cannot be edited", res.json()["detail"])
