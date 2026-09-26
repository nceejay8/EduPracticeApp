// Resolution and env shim for the Node test runner. See ./register.mjs.
const EXTS = ['.js', '.jsx', '/index.js', '/index.jsx'];

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      for (const ext of EXTS) {
        try {
          return await next(specifier + ext, context);
        } catch {
          // Try the next candidate extension.
        }
      }
    }
    throw err;
  }
}

export async function load(url, context, next) {
  const result = await next(url, context);
  if (result.format === 'module' && result.source) {
    const source = result.source.toString();
    if (source.includes('import.meta.env')) {
      return { ...result, source: source.replaceAll('import.meta.env', '({} /* env shim */)') };
    }
  }
  return result;
}
