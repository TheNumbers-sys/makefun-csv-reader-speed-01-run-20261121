export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null, width = -1, pos = text.charCodeAt(0) === 0xfeff ? 1 : 0, line = 1;
  const at = i => i < n ? text[i] : '';
  let recordLine = 1, recordRow = null;
  const err = code => errors.push({ code, line: recordLine, row: recordRow });

  function unquoted(initial = '') {
    let start = pos, parts = null, added = 0;
    while (pos < n) {
      let comma = text.indexOf(',', pos), lf = text.indexOf('\n', pos), cr = text.indexOf('\r', pos);
      if (comma < 0) comma = n;
      if (lf < 0) lf = n;
      if (cr < 0) cr = n;
      pos = Math.min(comma, lf, cr);
      if (pos === n) break;
      const c = text[pos];
      if (c === ',' || c === '\n') {
        added += pos - start;
        const end = parts ? (parts.push(text.slice(start, pos)), parts.join('')) : text.slice(start, pos);
        pos++;
        if (c === '\n') line++;
        return { value: initial + end, ended: c === ',' ? 0 : 1, added };
      }
      if (c === '\r') {
        if (at(pos + 1) === '\n') {
          added += pos - start;
          const end = parts ? (parts.push(text.slice(start, pos)), parts.join('')) : text.slice(start, pos);
          pos += 2; line++;
          return { value: initial + end, ended: 1, added };
        }
        added += pos - start;
        if (!parts) parts = [text.slice(start, pos)];
        else parts.push(text.slice(start, pos));
        err('stray_cr'); pos++; start = pos; continue;
      }
      pos++;
    }
    added += pos - start;
    const end = parts ? (parts.push(text.slice(start, pos)), parts.join('')) : text.slice(start, pos);
    return { value: initial + end, ended: 2, added };
  }

  function quoted() {
    const open = pos, openLine = line;
    let p = pos + 1, chunk = p, parts = null, closed = false;
    while (p < n) {
      const c = text[p];
      if (c === '"') {
        if (text.charCodeAt(p + 1) === 34) {
          if (!parts) parts = [];
          parts.push(text.slice(chunk, p), '"'); p += 2; chunk = p; continue;
        }
        if (parts) parts.push(text.slice(chunk, p));
        p++; closed = true; break;
      }
      if (c === '\r') {
        if (!parts) parts = [];
        parts.push(text.slice(chunk, p), '\n');
        p += text.charCodeAt(p + 1) === 10 ? 2 : 1; line++; chunk = p; continue;
      }
      if (c === '\n') line++;
      p++;
    }
    if (!closed) {
      pos = open + 1; line = openLine; err('unterminated_quote');
      const u = unquoted('"'); return u;
    }
    const value = parts ? parts.join('') : text.slice(open + 1, p - 1);
    pos = p;
    if (pos >= n) return { value, ended: 2 };
    const c = text[pos];
    if (c === ',') { pos++; return { value, ended: 0 }; }
    if (c === '\n') { pos++; line++; return { value, ended: 1 }; }
    if (c === '\r' && at(pos + 1) === '\n') { pos += 2; line++; return { value, ended: 1 }; }
    const junk = unquoted(value);
    if (junk.added > 0) err('quote_junk');
    return junk;
  }

  while (true) {
    while (pos < n && (text[pos] === '\n' || (text[pos] === '\r' && at(pos + 1) === '\n'))) {
      if (text[pos++] === '\r') pos++;
      line++;
    }
    if (pos >= n) break;
    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let f, wasQuoted;
    do {
      wasQuoted = text[pos] === '"';
      f = wasQuoted ? quoted() : unquoted();
      fields.push(f.value);
    } while (f.ended === 0);
    if (fields.length === 1 && fields[0] === '' && !wasQuoted) continue;
    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; continue; }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
