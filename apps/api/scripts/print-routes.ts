// Prints the API route table (method, path, auth, roles, body validation) as Markdown.
//   npm run routes -w apps/api
process.env.NODE_ENV ??= 'development';
const { ROUTES } = await import('../src/app.js');
const { describeRoutes } = await import('../src/lib/routeTable.js');

const rows = describeRoutes(ROUTES);
console.log('| Method | Path | Sign-in | Roles | Body validated |');
console.log('| --- | --- | --- | --- | --- |');
for (const r of rows) {
  console.log(`| ${r.method} | \`${r.path}\` | ${r.auth ? 'yes' : '**public**'} | ${r.roles?.join(', ') ?? (r.auth ? 'any' : '-')} | ${r.validatesBody ? 'zod' : '-'} |`);
}
console.log(`\n${rows.length} routes, ${rows.filter((r) => !r.auth).length} public.`);
