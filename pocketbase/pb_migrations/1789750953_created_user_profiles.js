/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "7erhr10nca06ph5",
    "created": "2026-09-18 17:02:33.524Z",
    "updated": "2026-09-18 17:02:33.524Z",
    "name": "user_profiles",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "eyqynhrg",
        "name": "username",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "cgikx6z5",
        "name": "user_id",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      }
    ],
    "indexes": [],
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("7erhr10nca06ph5");

  return dao.deleteCollection(collection);
})
