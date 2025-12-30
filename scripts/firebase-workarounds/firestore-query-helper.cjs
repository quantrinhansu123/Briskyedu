#!/usr/bin/env node
/**
 * Firestore Query Helper
 * Workaround for broken MCP tool: firestore_query_collection
 *
 * Root Cause: MCP plugin sends read_time timestamp in the future (clock sync issue)
 * Solution: Use REST API without read_time parameter
 *
 * Usage:
 *   node firestore-query-helper.js list-collections
 *   node firestore-query-helper.js query <collection> [--where field=value] [--limit N]
 *   node firestore-query-helper.js get <document-path>
 */

const https = require('https');
const { execSync } = require('child_process');

// Configuration - EduManager Pro
const CONFIG = {
  projectId: 'edumanager-pro-6180f',
  databaseId: '(default)'
};

function getAccessToken() {
  try {
    return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error('Error getting access token. Run: gcloud auth login');
    process.exit(1);
  }
}

async function firestoreRequest(method, path, body = null) {
  const token = getAccessToken();

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${CONFIG.projectId}/databases/${CONFIG.databaseId}${path}`,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function listCollections() {
  console.log('Listing root collections...');
  const result = await firestoreRequest('POST', '/documents:listCollectionIds', {});

  if (result.collectionIds && result.collectionIds.length > 0) {
    console.log('\nCollections:');
    result.collectionIds.forEach(id => console.log(`  - ${id}`));
  } else {
    console.log('No collections found.');
  }

  return result;
}

async function queryCollection(collectionPath, filters = [], limit = 10, orderBy = null) {
  console.log(`Querying collection: ${collectionPath}`);

  // Build structured query WITHOUT read_time (this is the fix!)
  const structuredQuery = {
    from: [{ collectionId: collectionPath.split('/').pop() }],
    limit: limit
  };

  // Add parent path for subcollections
  const parentPath = collectionPath.includes('/')
    ? `/documents/${collectionPath.split('/').slice(0, -1).join('/')}`
    : '/documents';

  // Add filters if provided
  if (filters.length > 0) {
    const whereFilters = filters.map(f => {
      const [field, op, value] = parseFilter(f);
      return {
        fieldFilter: {
          field: { fieldPath: field },
          op: op,
          value: convertValue(value)
        }
      };
    });

    if (whereFilters.length === 1) {
      structuredQuery.where = whereFilters[0];
    } else {
      structuredQuery.where = {
        compositeFilter: {
          op: 'AND',
          filters: whereFilters
        }
      };
    }
  }

  // Add orderBy if provided
  if (orderBy) {
    const [field, direction] = orderBy.split(':');
    structuredQuery.orderBy = [{
      field: { fieldPath: field },
      direction: direction?.toUpperCase() === 'DESC' ? 'DESCENDING' : 'ASCENDING'
    }];
  }

  const result = await firestoreRequest('POST', `${parentPath}:runQuery`, { structuredQuery });

  if (Array.isArray(result)) {
    const docs = result
      .filter(r => r.document)
      .map(r => ({
        id: r.document.name.split('/').pop(),
        path: r.document.name,
        data: parseFirestoreDocument(r.document.fields)
      }));

    console.log(`\nFound ${docs.length} documents:\n`);
    docs.forEach(doc => {
      console.log(`ID: ${doc.id}`);
      console.log(JSON.stringify(doc.data, null, 2));
      console.log('---');
    });

    return docs;
  }

  return result;
}

async function getDocument(documentPath) {
  console.log(`Getting document: ${documentPath}`);
  const result = await firestoreRequest('GET', `/documents/${documentPath}`);

  if (result.fields) {
    const data = parseFirestoreDocument(result.fields);
    console.log(JSON.stringify(data, null, 2));
    return data;
  }

  return result;
}

// Helper: Parse filter string like "name=John" or "age>18"
function parseFilter(filterStr) {
  const operators = ['>=', '<=', '!=', '==', '=', '>', '<'];

  for (const op of operators) {
    if (filterStr.includes(op)) {
      const [field, value] = filterStr.split(op);
      const firestoreOp = {
        '>=': 'GREATER_THAN_OR_EQUAL',
        '<=': 'LESS_THAN_OR_EQUAL',
        '>': 'GREATER_THAN',
        '<': 'LESS_THAN',
        '!=': 'NOT_EQUAL',
        '==': 'EQUAL',
        '=': 'EQUAL'
      }[op];
      return [field.trim(), firestoreOp, value.trim()];
    }
  }

  throw new Error(`Invalid filter format: ${filterStr}. Use format: field=value`);
}

// Helper: Convert JS value to Firestore value format
function convertValue(value) {
  // Try to parse as number
  if (!isNaN(value) && value !== '') {
    const num = Number(value);
    if (Number.isInteger(num)) {
      return { integerValue: num.toString() };
    }
    return { doubleValue: num };
  }

  // Boolean
  if (value.toLowerCase() === 'true') return { booleanValue: true };
  if (value.toLowerCase() === 'false') return { booleanValue: false };

  // Null
  if (value.toLowerCase() === 'null') return { nullValue: null };

  // Default to string
  return { stringValue: value };
}

// Helper: Parse Firestore document fields to plain JS object
function parseFirestoreDocument(fields) {
  const result = {};

  for (const [key, value] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(value);
  }

  return result;
}

function parseFirestoreValue(value) {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue !== undefined) return new Date(value.timestampValue);
  if (value.arrayValue !== undefined) {
    return (value.arrayValue.values || []).map(parseFirestoreValue);
  }
  if (value.mapValue !== undefined) {
    return parseFirestoreDocument(value.mapValue.fields || {});
  }
  if (value.geoPointValue !== undefined) {
    return { lat: value.geoPointValue.latitude, lng: value.geoPointValue.longitude };
  }
  if (value.referenceValue !== undefined) return value.referenceValue;

  return value;
}

// CLI Handler
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(`
Firestore Query Helper - EduManager Pro
========================================
Workaround for broken MCP tool (read_time bug)

Commands:
  list-collections                    - List all root collections
  query <collection> [options]        - Query a collection
  get <document-path>                 - Get a single document

Query Options:
  --where <field>=<value>             - Add filter (can use multiple)
  --where <field>><value>             - Greater than filter
  --limit <N>                         - Limit results (default: 10)
  --order <field>[:asc|:desc]         - Order by field

Examples:
  node firestore-query-helper.js list-collections
  node firestore-query-helper.js query workSessions --limit 50
  node firestore-query-helper.js query classes --where status=Đang học
  node firestore-query-helper.js get workSessions/abc123
`);
    return;
  }

  try {
    switch (command.toLowerCase()) {
      case 'list-collections':
        await listCollections();
        break;

      case 'query': {
        const collection = args[1];
        if (!collection) throw new Error('Collection name required');

        const filters = [];
        let limit = 10;
        let orderBy = null;

        for (let i = 2; i < args.length; i++) {
          if (args[i] === '--where' && args[i + 1]) {
            filters.push(args[++i]);
          } else if (args[i] === '--limit' && args[i + 1]) {
            limit = parseInt(args[++i]);
          } else if (args[i] === '--order' && args[i + 1]) {
            orderBy = args[++i];
          }
        }

        await queryCollection(collection, filters, limit, orderBy);
        break;
      }

      case 'get': {
        const docPath = args[1];
        if (!docPath) throw new Error('Document path required');
        await getDocument(docPath);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
