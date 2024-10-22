import { getDependencies } from '../vendor.mjs';
import optionAPI from '../api/option.mjs';
import traverse from './traverse.mjs';
import random from './random.mjs';
import utils from './utils.mjs';
import buildResolveSchema from './buildResolveSchema.mjs';

function pick(data) {
  return Array.isArray(data)
    ? random.pick(data)
    : data;
}

function cycle(data, reverse) {
  if (!Array.isArray(data)) {
    return data;
  }

  const value = reverse
    ? data.pop()
    : data.shift();

  if (reverse) {
    data.unshift(value);
  } else {
    data.push(value);
  }

  return value;
}

function resolve(obj, data, values, property) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (!values) {
    values = {};
  }

  if (!data) {
    data = obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(x => resolve(x, data, values, property));
  }

  if (obj.jsonPath) {
    const { JSONPath } = getDependencies();

    const params = typeof obj.jsonPath !== 'object'
      ? { path: obj.jsonPath }
      : obj.jsonPath;

    params.group = obj.group || params.group || property;
    params.cycle = obj.cycle || params.cycle || false;
    params.reverse = obj.reverse || params.reverse || false;
    params.count = obj.count || params.count || 1;

    const key = `${params.group}__${params.path}`;

    if (!values[key]) {
      if (params.count > 1) {
        values[key] = JSONPath(params.path, data).slice(0, params.count);
      } else {
        values[key] = JSONPath(params.path, data);
      }
    }

    if (params.cycle || params.reverse) {
      return cycle(values[key], params.reverse);
    }

    return pick(values[key]);
  }

  Object.keys(obj).forEach(k => {
    obj[k] = resolve(obj[k], data, values, k);
  });

  return obj;
}

// TODO provide types?
function run(refs, schema, container, synchronous) {
  if (Object.prototype.toString.call(schema) !== '[object Object]') {
    throw new Error(`Invalid input, expecting object but given ${typeof schema}`);
  }

  const refDepthMin = optionAPI('refDepthMin') || 0;
  const refDepthMax = optionAPI('refDepthMax') || 3;
  const ignoreRefNotFound = optionAPI('ignoreRefNotFound') || false;

  try {
    const { resolveSchema } = buildResolveSchema({
      refs,
      schema,
      container,
      synchronous,
      refDepthMin,
      refDepthMax,
      ignoreRefNotFound,
    });
    const result = traverse(utils.clone(schema), [], resolveSchema);

    if (optionAPI('resolveJsonPath')) {
      return {
        value: resolve(result.value),
        context: result.context,
      };
    }

    return result;
  } catch (e) {
    if (e.path) {
      throw new Error(`${e.message} in /${e.path.join('/')}`);
    } else {
      throw e;
    }
  }
}

export default run;
