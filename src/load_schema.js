import _ from 'lodash';
import path from 'path';

import {
  loadFiles, definitionName, standardizeSchemaDefinition,
  isRelationship, isIndex, isMigration, isSeed,
} from './util';

const combine = (schema, partial) => {
  return {
    schema: {
      ...schema.schema,
      ...(partial.schema || {}),
    },

    relationships: [
      ...schema.relationships,
      ...(partial.relationships || []),
    ],

    indexes: [
      ...schema.indexes,
      ...(partial.indexes || []),
    ],

    migrations: [
      ...schema.migrations,
      ...(partial.migrations || []),
    ],

    seeds: [
      ...schema.seeds,
      ...(partial.seeds || []),
    ]
  };
};

// parse the definitions from the file (allow multiple per file)
const parseDefinitions = (module, filePath) => {
  const keys = _.keys(module);

  return _.reduce(keys, (schema, key) => {
    const def = module[key];

    if (isRelationship(def)) {
      return combine(schema, { relationships: [def] });
    }

    if (isIndex(def)) {
      return combine(schema, { indexes: [def] });
    }

    if (isMigration(def, filePath)) {
      const migration = { version: path.parse(filePath).name, migration: def };
      return combine(schema, { migrations: [migration] });
    }

    if (isSeed(def, filePath)) {
      const seed = { name: path.parse(filePath).name, seeds: def };
      return combine(schema, { seeds: [seed] });
    }

    // assume schema item to save the check
    const name = definitionName(key, filePath);
    const standardized = standardizeSchemaDefinition(def);

    return combine(schema, { schema: { [name]: standardized } });
  }, { schema: {}, relationships: [], indexes: [], migrations: [], seeds: [] });
};

// load schema
export default (config) => {
  if (!config.path) {
    return [];
  }

  // load the schema
  const files = loadFiles(config.path, 'schema');

  const schema = _.reduce(files, (schema, filePath) => {
    const module = require(filePath);
    const partial = parseDefinitions(module, filePath);

    return combine(schema, partial);
  }, { schema: {}, relationships: [], indexes: [], migrations: [], seeds: [] });

  // if we have a database go ahead and synchronize the schema
  if (config.database) {
    config.database.synchronizeSchema(schema);
  }

  return schema;
};
