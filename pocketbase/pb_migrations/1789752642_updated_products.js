/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("1sfiif6oa7w7zm3")

  // update
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "w9ukcrhf",
    "name": "stock_quantity",
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "noDecimal": false
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("1sfiif6oa7w7zm3")

  // update
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "w9ukcrhf",
    "name": "stock_quantity",
    "type": "number",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "noDecimal": false
    }
  }))

  return dao.saveCollection(collection)
})
