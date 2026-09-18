/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "h1vhq34qvtt92vv",
    "created": "2026-09-18 17:03:37.817Z",
    "updated": "2026-09-18 17:03:37.817Z",
    "name": "user_requests",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "dvtj0ac3",
        "name": "items",
        "type": "json",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSize": 5000000
        }
      },
      {
        "system": false,
        "id": "4o0g3qmv",
        "name": "total_price",
        "type": "number",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "noDecimal": false
        }
      },
      {
        "system": false,
        "id": "kz8rv6mj",
        "name": "status",
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
        "id": "p374ndol",
        "name": "username",
        "type": "text",
        "required": false,
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
  const collection = dao.findCollectionByNameOrId("h1vhq34qvtt92vv");

  return dao.deleteCollection(collection);
})
