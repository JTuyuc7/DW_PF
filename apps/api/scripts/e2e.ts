// Prueba de extremo a extremo contra la API en ejecución (por defecto http://localhost:4000).
// Requiere los datos semilla. Crea pedidos y mueve inventario: usar solo en desarrollo.
//
//   docker compose up -d --build db api
//   cd apps/api && bun run test:e2e
const PASSWORD = process.env.SEED_PASSWORD;
if (!PASSWORD) throw new Error("SEED_PASSWORD no está definida (el script npm la toma de ../../.env)");
const API = `${process.env.API_URL ?? "http://localhost:4000"}/api/v1`;

let pass = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) pass++;
  else {
    failures.push(name);
    console.log("FALLA:", name, extra !== undefined ? JSON.stringify(extra) : "");
  }
}

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(API + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json().catch(() => null);
  return { status: res.status, json, headers: res.headers };
}

async function login(email: string) {
  const r = await call("POST", "/auth/login", undefined, { email, password: PASSWORD });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status}`);
  return r.json.token as string;
}

const t = {
  dueno: await login("dueno@transport.gt"),
  gerExt: await login("gerente@transport.gt"),
  opExt: await login("operativo.extraccion@transport.gt"),
  gerPro: await login("gerente.proceso@transport.gt"),
  opPro: await login("operativo@transport.gt"),
  vendedor: await login("vendedor@transport.gt"),
  vendProc: await login("vendedor.proceso@transport.gt"),
  admin: await login("administrativo@transport.gt"),
  cliente: await login("cliente@ejemplo.gt"),
};

// --- Autenticación y formato de error
{
  const bad = await call("POST", "/auth/login", undefined, { email: "x@y.gt", password: "mal" });
  check("login inválido -> 401 INVALID_CREDENTIALS", bad.status === 401 && bad.json.error.code === "INVALID_CREDENTIALS");
  check("error trae requestId", typeof bad.json.error.requestId === "string" && bad.headers.get("x-request-id") === bad.json.error.requestId);
  const val = await call("POST", "/auth/login", undefined, { email: "no-es-correo" });
  check("login con datos inválidos -> 400 VALIDATION_ERROR con details", val.status === 400 && val.json.error.code === "VALIDATION_ERROR" && val.json.error.details.length >= 1, val.json);
  const noTok = await call("GET", "/orders");
  check("sin token -> 401 UNAUTHORIZED", noTok.status === 401 && noTok.json.error.code === "UNAUTHORIZED", noTok.json);
  const garbage = await call("GET", "/orders", "token.invalido.aqui");
  check("token inválido -> 401", garbage.status === 401, garbage.json);
  const nf = await call("GET", "/no-existe", t.dueno);
  check("ruta inexistente -> 404 NOT_FOUND", nf.status === 404 && nf.json.error.code === "NOT_FOUND");
  const me = await call("GET", "/auth/me", t.opPro);
  check("/me devuelve membresías con nombre de giro", me.status === 200 && me.json.memberships[0].role === "operativo" && me.json.memberships[0].businessUnitName === "Proceso de materia prima", me.json);
  const meCli = await call("GET", "/auth/me", t.cliente);
  check("/me del cliente: sin membresías", meCli.status === 200 && meCli.json.memberships.length === 0);
}

// --- Público
const units = await call("GET", "/public/business-units");
check("public: 6 giros", units.status === 200 && units.json.items.length === 6);
check("public: cada giro trae sus sedes (Extracción: 4 departamentos)", units.json.items.every((u: any) => Array.isArray(u.sites)) && units.json.items.find((u: any) => u.code === "EXT").sites.length === 4, units.json.items[0]);
const unitId = (code: string) => units.json.items.find((u: any) => u.code === code).id as number;
const EXT = unitId("EXT");
const PRO = unitId("PRO");
const MAQ = unitId("MAQ");
const prods = await call("GET", "/public/products");
check("public: catálogo con productos", prods.status === 200 && prods.json.items.length >= 6);
const caliza = prods.json.items.find((p: any) => p.name === "Piedra caliza en bruto").id as number;
const agregado = prods.json.items.find((p: any) => p.name === "Agregado triturado").id as number;
const filtered = await call("GET", `/public/products?businessUnitId=${EXT}`);
check("public: filtro por giro", filtered.json.items.every((p: any) => p.businessUnitId === EXT) && filtered.json.items.length === 2);

// Cada despacho descuenta inventario, así que se restablecen las existencias de ejemplo para poder repetir la suite.
{
  const items = (await call("GET", "/inventory", t.dueno)).json.items;
  for (const [site, qty] of [["Cobán", 1000], ["Quetzaltenango", 450]] as const) {
    const row = items.find((i: any) => i.businessUnitId === EXT && i.siteName === site && i.productId === caliza);
    await call("PATCH", `/inventory/${row.siteId}/${caliza}`, t.gerExt, { quantity: qty });
  }
}

// --- Visibilidad de pedidos
{
  const seedVisible = async (tok: string) => (await call("GET", "/orders", tok)).json;
  for (const [name, tok] of [["dueno", t.dueno], ["gerente EXT", t.gerExt], ["operativo EXT", t.opExt], ["gerente PRO", t.gerPro], ["operativo PRO", t.opPro], ["vendedor", t.vendedor], ["administrativo EXT", t.admin]] as const) {
    const r = await call("GET", "/orders/1", tok);
    check(`ve el pedido semilla: ${name}`, r.status === 200 && r.json.id === 1, r.status);
  }
  const cli = await seedVisible(t.cliente);
  check("cliente sin membresías no ve pedidos", cli.total === 0 && cli.items.length === 0);
  const d1 = await call("GET", "/orders/1", t.cliente);
  check("cliente: detalle ajeno -> 404", d1.status === 404 && d1.json.error.code === "ORDER_NOT_FOUND");
  const d404 = await call("GET", "/orders/99999", t.dueno);
  check("pedido inexistente -> 404", d404.status === 404);
  const dBad = await call("GET", "/orders/abc", t.dueno);
  check("id no numérico -> 400", dBad.status === 400);
}

// --- Creación
const createBody = (over: any = {}) => ({
  kind: "interno", supplierUnitId: EXT, requestingUnitId: PRO,
  dueDate: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
  items: [{ productId: caliza, quantity: 120 }], ...over,
});
let orderId = 0;
{
  const ok = await call("POST", "/orders", t.opPro, createBody());
  check("crear pedido interno -> 201 solicitado", ok.status === 201 && ok.json.status === "solicitado" && ok.json.supplierUnitName && ok.json.items[0].quantity === 120, ok.json);
  orderId = ok.json.id;
  check("detalle trae historial inicial", ok.json.history.length === 1 && ok.json.history[0].toStatus === "solicitado");
  check("solicitante operativo: sin acciones disponibles en solicitado", Array.isArray(ok.json.allowedTransitions) && ok.json.allowedTransitions.length === 0, ok.json.allowedTransitions);

  const draft = await call("POST", "/orders", t.gerPro, createBody({ status: "borrador" }));
  check("crear en borrador", draft.status === 201 && draft.json.status === "borrador" && draft.json.allowedTransitions.includes("solicitado"), draft.json);

  const wrongSide = await call("POST", "/orders", t.opExt, createBody());
  check("operativo del proveedor no crea para el solicitante -> 403", wrongSide.status === 403, wrongSide.json);
  const vend = await call("POST", "/orders", t.vendedor, createBody());
  check("vendedor no crea pedido interno -> 403", vend.status === 403);
  const adm = await call("POST", "/orders", t.admin, createBody({ requestingUnitId: EXT, supplierUnitId: PRO, items: [{ productId: agregado, quantity: 1 }] }));
  check("administrativo no crea -> 403", adm.status === 403);
  const noTok = await call("POST", "/orders", undefined, createBody());
  check("crear sin token -> 401", noTok.status === 401);

  const same = await call("POST", "/orders", t.opPro, createBody({ supplierUnitId: PRO }));
  check("mismo giro -> 422 SAME_UNIT", same.status === 422 && same.json.error.code === "SAME_UNIT", same.json);
  const wrongProd = await call("POST", "/orders", t.opPro, createBody({ items: [{ productId: agregado, quantity: 5 }] }));
  check("producto de otro giro -> 422", wrongProd.status === 422 && wrongProd.json.error.code === "PRODUCT_NOT_FROM_SUPPLIER", wrongProd.json);
  const ghostProd = await call("POST", "/orders", t.opPro, createBody({ items: [{ productId: 99999, quantity: 5 }] }));
  check("producto inexistente -> 422", ghostProd.status === 422);
  const past = await call("POST", "/orders", t.opPro, createBody({ dueDate: "2020-01-01" }));
  check("fecha pasada -> 422 DUE_DATE_IN_PAST", past.status === 422 && past.json.error.code === "DUE_DATE_IN_PAST", past.json);
  const ghostUnit = await call("POST", "/orders", t.opPro, createBody({ supplierUnitId: 9999 }));
  check("giro proveedor inexistente -> 422", ghostUnit.status === 422 && ghostUnit.json.error.code === "UNIT_NOT_FOUND", ghostUnit.json);
  const zero = await call("POST", "/orders", t.opPro, createBody({ items: [{ productId: caliza, quantity: 0 }] }));
  check("cantidad 0 -> 400", zero.status === 400 && zero.json.error.code === "VALIDATION_ERROR");
  const neg = await call("POST", "/orders", t.opPro, createBody({ items: [{ productId: caliza, quantity: -3 }] }));
  check("cantidad negativa -> 400", neg.status === 400);
  const empty = await call("POST", "/orders", t.opPro, createBody({ items: [] }));
  check("sin líneas -> 400", empty.status === 400);
  const dup = await call("POST", "/orders", t.opPro, createBody({ items: [{ productId: caliza, quantity: 1 }, { productId: caliza, quantity: 2 }] }));
  check("producto repetido -> 400", dup.status === 400);
  const badDate = await call("POST", "/orders", t.opPro, createBody({ dueDate: "2026-02-30" }));
  check("fecha imposible -> 400", badDate.status === 400);
  for (const d of ["2026-13-45", "ayer", "", "9999-99-99"]) {
    const r = await call("POST", "/orders", t.opPro, createBody({ dueDate: d }));
    check(`fecha inválida '${d}' -> 400 y no 500`, r.status === 400 && r.json.error.code === "VALIDATION_ERROR", r.json);
  }
  const kind = await call("POST", "/orders", t.opPro, createBody({ kind: "cliente" }));
  check("kind distinto de interno -> 400 (aún no soportado)", kind.status === 400);
  const mal = await fetch(API + "/orders", { method: "POST", headers: { Authorization: `Bearer ${t.opPro}`, "Content-Type": "application/json" }, body: "{no es json" });
  const malJson: any = await mal.json();
  check("JSON mal formado -> 400 con formato uniforme", mal.status === 400 && malJson.error?.requestId, malJson);
}

// --- Transiciones
{
  const patch = (tok: string, status: string) => call("PATCH", `/orders/${orderId}/status`, tok, { status });
  const detail = async (tok: string) => (await call("GET", `/orders/${orderId}`, tok)).json;

  check("gerente proveedor ve aprobar/cancelar", JSON.stringify((await detail(t.gerExt)).allowedTransitions.sort()) === JSON.stringify(["aprobado", "cancelado"]));
  check("operativo solicitante no aprueba -> 403", (await patch(t.opPro, "aprobado")).status === 403);
  check("operativo proveedor no aprueba -> 403", (await patch(t.opExt, "aprobado")).status === 403);
  check("vendedor no aprueba -> 403", (await patch(t.vendedor, "aprobado")).status === 403);
  check("cliente sobre pedido ajeno -> 404", (await patch(t.cliente, "aprobado")).status === 404);
  const skip = await patch(t.gerExt, "entregado");
  check("saltar estados -> 409 ORDER_INVALID_TRANSITION", skip.status === 409 && skip.json.error.code === "ORDER_INVALID_TRANSITION", skip.json);
  const same = await patch(t.gerExt, "solicitado");
  check("mismo estado -> 409", same.status === 409);
  const bad = await patch(t.gerExt, "volando");
  check("estado desconocido -> 400", bad.status === 400);

  const approved = await patch(t.gerExt, "aprobado");
  check("gerente proveedor aprueba -> 200", approved.status === 200 && approved.json.status === "aprobado", approved.json);
  check("operativo proveedor pasa a en_proceso", (await patch(t.opExt, "en_proceso")).json.status === "en_proceso");

  const before = (await call("GET", "/inventory?businessUnitId=" + EXT, t.gerExt)).json.items.filter((i: any) => i.productId === caliza);
  const totalBefore = before.reduce((s: number, i: any) => s + i.quantity, 0);

  check("solicitante no despacha -> 403", (await patch(t.opPro, "despachado")).status === 403);
  const disp = await patch(t.opExt, "despachado");
  check("despachar -> 200", disp.status === 200 && disp.json.status === "despachado", disp.json);

  const after = (await call("GET", "/inventory?businessUnitId=" + EXT, t.gerExt)).json.items.filter((i: any) => i.productId === caliza);
  const totalAfter = after.reduce((s: number, i: any) => s + i.quantity, 0);
  check("despachar descuenta 120 t del inventario del proveedor", Math.round(totalBefore - totalAfter) === 120, { totalBefore, totalAfter });

  check("cancelar tras despachar -> 409", (await patch(t.gerExt, "cancelado")).status === 409);
  check("proveedor no confirma recepción -> 403", (await patch(t.gerExt, "entregado")).status === 403);
  const delivered = await patch(t.opPro, "entregado");
  check("solicitante confirma recepción -> 200", delivered.status === 200 && delivered.json.status === "entregado");
  check("historial completo con 5 eventos", delivered.json.history.length === 5, delivered.json.history.length);
  check("estado final sin acciones", (await detail(t.gerExt)).allowedTransitions.length === 0);
  check("entregado no se cancela -> 409", (await patch(t.gerExt, "cancelado")).status === 409);
}

// --- Stock insuficiente: la transacción se revierte
{
  const big = await call("POST", "/orders", t.opPro, createBody({ items: [{ productId: caliza, quantity: 50000 }] }));
  const id = big.json.id;
  const p = (tok: string, status: string) => call("PATCH", `/orders/${id}/status`, tok, { status });
  await p(t.gerExt, "aprobado");
  await p(t.opExt, "en_proceso");
  const inv0 = JSON.stringify((await call("GET", "/inventory", t.dueno)).json.items);
  const fail = await p(t.opExt, "despachado");
  check("stock insuficiente -> 422 INSUFFICIENT_STOCK", fail.status === 422 && fail.json.error.code === "INSUFFICIENT_STOCK", fail.json);
  const after = (await call("GET", `/orders/${id}`, t.gerExt)).json;
  check("el pedido sigue en_proceso (rollback)", after.status === "en_proceso" && after.history.length === 3, after.history);
  check("el inventario no cambió", JSON.stringify((await call("GET", "/inventory", t.dueno)).json.items) === inv0);
  const cancel = await p(t.gerPro, "cancelado");
  check("el gerente solicitante puede cancelar en_proceso", cancel.status === 200 && cancel.json.status === "cancelado");
}

// --- Mensajes
{
  const post = await call("POST", `/orders/${orderId}/messages`, t.opPro, { body: "  ¿Pueden entregar en la sede Norte?  " });
  check("publicar mensaje -> 201 recortado", post.status === 201 && post.json.body === "¿Pueden entregar en la sede Norte?" && post.json.authorName, post.json);
  await call("POST", `/orders/${orderId}/messages`, t.gerExt, { body: "Sí, confirmado." });
  const list = await call("GET", `/orders/${orderId}/messages`, t.opExt);
  check("el otro giro lee el hilo en orden", list.status === 200 && list.json.items.length === 2 && list.json.items[1].body === "Sí, confirmado.", list.json);
  check("mensaje vacío -> 400", (await call("POST", `/orders/${orderId}/messages`, t.opPro, { body: "   " })).status === 400);
  check("cliente no lee hilo ajeno -> 404", (await call("GET", `/orders/${orderId}/messages`, t.cliente)).status === 404);
  check("cliente no publica en hilo ajeno -> 404", (await call("POST", `/orders/${orderId}/messages`, t.cliente, { body: "hola" })).status === 404);
}

// --- Listado: filtros y paginación
{
  const all = (await call("GET", "/orders?pageSize=2&page=1", t.dueno)).json;
  check("paginación: pageSize 2", all.items.length === 2 && all.total >= 4 && all.pageSize === 2 && all.page === 1);
  check("orden: más reciente primero", all.items[0].id > all.items[1].id);
  const p2 = (await call("GET", "/orders?pageSize=2&page=2", t.dueno)).json;
  check("página 2 distinta de la 1", p2.items[0].id < all.items[1].id);
  const far = (await call("GET", "/orders?page=99", t.dueno)).json;
  check("página fuera de rango vacía", far.items.length === 0 && far.total === all.total);
  const sup = (await call("GET", `/orders?businessUnitId=${EXT}&relation=supplier`, t.gerExt)).json;
  check("relation=supplier del giro EXT", sup.total >= 1 && sup.items.every((o: any) => o.supplierUnitId === EXT));
  const req = (await call("GET", `/orders?businessUnitId=${EXT}&relation=requester`, t.gerExt)).json;
  check("relation=requester de EXT: ninguno", req.total === 0);
  const mine = (await call("GET", "/orders?relation=requester", t.opPro)).json;
  check("sin giro: relation=requester usa mis giros", mine.total >= 1 && mine.items.every((o: any) => o.requestingUnitId === PRO));
  const st = (await call("GET", "/orders?status=entregado", t.dueno)).json;
  check("filtro por estado", st.items.length >= 1 && st.items.every((o: any) => o.status === "entregado"));
  const other = (await call("GET", `/orders?businessUnitId=${MAQ}`, t.opPro)).json;
  check("giro ajeno -> vacío, sin filtrar datos", other.total === 0);
  const day = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10); // hoy en Guatemala (UTC-6)
  const range = (await call("GET", `/orders?from=${day}&to=${day}`, t.dueno)).json;
  check("filtro por fechas incluye hoy", range.total >= 1);
  const old = (await call("GET", "/orders?from=2020-01-01&to=2020-01-31", t.dueno)).json;
  check("filtro por fechas excluye otros días", old.total === 0);
  check("pageSize > 100 -> 400", (await call("GET", "/orders?pageSize=500", t.dueno)).status === 400);
  check("status inválido -> 400", (await call("GET", "/orders?status=zzz", t.dueno)).status === 400);
  check("lista incluye líneas del pedido", all.items.every((o: any) => Array.isArray(o.items) && o.items.length >= 1 && o.items[0].productName));
}

// --- Inventario
{
  const dueno = await call("GET", "/inventory", t.dueno);
  check("inventario: el dueño ve todo", dueno.status === 200 && dueno.json.items.length === 5, dueno.json.items?.length);
  const pro = await call("GET", "/inventory", t.opPro);
  check("inventario: operativo PRO solo ve PRO", pro.status === 200 && pro.json.items.length === 2 && pro.json.items.every((i: any) => i.businessUnitId === PRO));
  check("inventario: vendedor -> 403", (await call("GET", "/inventory", t.vendedor)).status === 403);
  check("inventario: cliente -> 403", (await call("GET", "/inventory", t.cliente)).status === 403);
  check("inventario: administrativo -> 403", (await call("GET", "/inventory", t.admin)).status === 403);
  check("inventario sin token -> 401", (await call("GET", "/inventory")).status === 401);

  const av = await call("GET", `/inventory/availability?businessUnitId=${EXT}`, t.opPro);
  check("disponibilidad: Proceso ve totales de Extracción sin detalle por sede", av.status === 200 && av.json.items.length === 2 && av.json.items.every((i: any) => typeof i.available === "number" && i.siteId === undefined), av.json);
  check("disponibilidad: suma las sedes del proveedor", Math.round(av.json.items.find((i: any) => i.productId === caliza).available) === Math.round(dueno.json.items.filter((i: any) => i.productId === caliza).reduce((s: number, i: any) => s + i.quantity, 0)));
  const avMaq = await call("GET", `/inventory/availability?businessUnitId=${MAQ}`, t.gerPro);
  check("disponibilidad: producto sin inventario aparece con 0", avMaq.status === 200 && avMaq.json.items.length === 1 && avMaq.json.items[0].available === 0, avMaq.json);
  check("disponibilidad: vendedor -> 403", (await call("GET", `/inventory/availability?businessUnitId=${EXT}`, t.vendedor)).status === 403);
  check("disponibilidad: cliente -> 403", (await call("GET", `/inventory/availability?businessUnitId=${EXT}`, t.cliente)).status === 403);
  check("disponibilidad: sin giro -> 400", (await call("GET", "/inventory/availability", t.opPro)).status === 400);
  check("inventario expone belowMinimum", dueno.json.items.every((i: any) => typeof i.belowMinimum === "boolean"));
}

// --- Ajuste de inventario y panel del giro
{
  const inv = (await call("GET", "/inventory?businessUnitId=" + EXT, t.gerExt)).json.items;
  const quetz = inv.find((i: any) => i.siteName === "Quetzaltenango" && i.productId === caliza);
  const url = `/inventory/${quetz.siteId}/${caliza}`;
  const panel = async (tok: string, unit = EXT) => call("GET", `/reports/business-units/${unit}`, tok);

  const base = await panel(t.gerExt);
  check("panel: el gerente del giro lo consulta -> 200 con su estructura", base.status === 200 && base.json.businessUnit.id === EXT && base.json.asSupplier && base.json.asRequester && Array.isArray(base.json.toAttend) && base.json.lowStock && base.json.meetings !== undefined, base.json);
  const attention = ["solicitado", "aprobado", "en_proceso"];
  check("panel: 'por atender' suma los estados de atención", base.json.asSupplier.toAttend === attention.reduce((s, k) => s + base.json.asSupplier.byStatus[k], 0));
  check("panel: la lista por atender solo trae pedidos en esos estados, ordenados por fecha", base.json.toAttend.length <= 5 && base.json.toAttend.every((o: any) => attention.includes(o.status)) && base.json.toAttend.every((o: any, i: number, a: any[]) => i === 0 || a[i - 1].dueDate <= o.dueDate));
  check("panel: cada pedido por atender trae sus líneas", base.json.toAttend.every((o: any) => o.items.length >= 1 && o.items[0].productName));
  check("panel: el gerente ve el conteo de reuniones", base.json.meetings && typeof base.json.meetings.requested === "number");
  check("panel: el operativo lo consulta sin ver reuniones", (await panel(t.opExt)).status === 200 && (await panel(t.opExt)).json.meetings === null);
  check("panel: el dueño lo consulta de cualquier giro", (await panel(t.dueno)).status === 200 && (await panel(t.dueno, PRO)).status === 200 && (await panel(t.dueno)).json.meetings !== null);
  for (const [n, tok] of [["gerente de otro giro", t.gerPro], ["operativo de otro giro", t.opPro], ["vendedor", t.vendedor], ["administrativo", t.admin], ["cliente", t.cliente]] as const) {
    check(`panel: ${n} -> 403`, (await panel(tok)).status === 403);
  }
  check("panel: sin token -> 401", (await call("GET", `/reports/business-units/${EXT}`)).status === 401);
  check("panel: giro inexistente -> 404", (await panel(t.dueno, 9999)).status === 404);
  check("panel: id no numérico -> 400", (await call("GET", "/reports/business-units/abc", t.dueno)).status === 400);

  // Un pedido nuevo suma al giro proveedor (por atender) y al solicitante (abiertos); al cancelarlo, vuelve todo.
  const reqBefore = (await panel(t.gerPro, PRO)).json.asRequester.open;
  const mk = await call("POST", "/orders", t.opPro, createBody());
  const after = await panel(t.gerExt), afterPro = await panel(t.gerPro, PRO);
  check("panel: un pedido nuevo suma a 'por atender' del proveedor", after.json.asSupplier.toAttend === base.json.asSupplier.toAttend + 1);
  check("panel: y a los abiertos del solicitante", afterPro.json.asRequester.open === reqBefore + 1);
  await call("PATCH", `/orders/${mk.json.id}/status`, t.gerExt, { status: "cancelado" });
  check("panel: cancelarlo lo quita de 'por atender'", (await panel(t.gerExt)).json.asSupplier.toAttend === base.json.asSupplier.toAttend);

  // Ajuste de existencias
  const low = await call("PATCH", url, t.opExt, { quantity: 50 });
  check("inventario: el operativo del giro ajusta existencias -> 200", low.status === 200 && low.json.quantity === 50 && low.json.belowMinimum === true, low.json);
  const withLow = await panel(t.gerExt);
  check("panel: la existencia bajo el mínimo aparece en 'bajo el mínimo'", withLow.json.lowStock.count === base.json.lowStock.count + 1 && withLow.json.lowStock.items.some((i: any) => i.siteName === "Quetzaltenango" && i.quantity === 50), withLow.json.lowStock);
  const fixed = await call("PATCH", url, t.gerExt, { quantity: 450 });
  check("inventario: el gerente repone -> 200 y deja de estar bajo el mínimo", fixed.status === 200 && fixed.json.belowMinimum === false);
  check("panel: al reponer vuelve al conteo original", (await panel(t.gerExt)).json.lowStock.count === base.json.lowStock.count);
  check("inventario: operativo de otro giro no ajusta -> 403", (await call("PATCH", url, t.opPro, { quantity: 1 })).status === 403);
  check("inventario: el dueño solo lee -> 403", (await call("PATCH", url, t.dueno, { quantity: 1 })).status === 403);
  check("inventario: vendedor -> 403", (await call("PATCH", url, t.vendedor, { quantity: 1 })).status === 403);
  check("inventario: cantidad negativa -> 400", (await call("PATCH", url, t.gerExt, { quantity: -5 })).status === 400);
  check("inventario: cantidad no numérica -> 400", (await call("PATCH", url, t.gerExt, { quantity: "mucho" })).status === 400);
  check("inventario: sede y producto sin registro -> 404", (await call("PATCH", `/inventory/${quetz.siteId}/99999`, t.gerExt, { quantity: 1 })).status === 404);
  check("inventario: sin token -> 401", (await call("PATCH", url, undefined, { quantity: 1 })).status === 401);
  check("inventario: la existencia quedó en 450", (await call("GET", "/inventory?businessUnitId=" + EXT, t.gerExt)).json.items.find((i: any) => i.siteId === quetz.siteId && i.productId === caliza).quantity === 450);
}

// --- Reuniones (sala de ventas)
{
  const tag = `e2e${Date.now()}`;
  const mail = (n: string) => `${tag}-${n}@example.com`;
  const body = (n: string, over: any = {}) => ({
    name: "Cliente de Prueba", company: "Constructora Prueba", taxId: "1234567-8", email: mail(n), phone: "5555-1234",
    businessUnitId: EXT, message: "Necesitamos cotizar material.", ...over,
  });
  const list = async (tok: string, q = "pageSize=100") => (await call("GET", `/meetings?${q}`, tok)).json;
  const mine = (j: any) => j.items.filter((m: any) => m.contactEmail.startsWith(tag));

  // Limpieza: se cancelan las reuniones abiertas para que el reparto parta de cero en cada ejecución.
  for (const tok of [t.gerExt, t.gerPro]) {
    for (const m of (await list(tok)).items.filter((m: any) => m.status === "solicitada" || m.status === "confirmada")) {
      await call("PATCH", `/meetings/${m.id}/status`, tok, { status: "cancelada" });
    }
  }

  const ok = await call("POST", "/public/meeting-requests", undefined, body("ext1"));
  check("reunión: solicitud pública -> 201", ok.status === 201 && ok.json.status === "solicitada" && typeof ok.json.message === "string", ok.json);
  check("reunión: la respuesta no devuelve datos del cliente ni identificadores", !JSON.stringify(ok.json).includes(tag) && ok.json.id === undefined);

  const invalid: [string, any][] = [
    ["sin nombre", { name: "" }], ["correo inválido", { email: "no-es-correo" }], ["teléfono inválido", { phone: "abc" }],
    ["giro no numérico", { businessUnitId: "x" }], ["mensaje demasiado largo", { message: "x".repeat(1001) }],
    ["NIT con símbolos", { taxId: "12<script>" }], ["fecha mal formada", { preferredDate: "ayer" }],
  ];
  for (const [name, over] of invalid) {
    const r = await call("POST", "/public/meeting-requests", undefined, body("bad", over));
    check(`reunión: ${name} -> 400`, r.status === 400 && r.json.error.code === "VALIDATION_ERROR", r.json);
  }
  const noUnit = await call("POST", "/public/meeting-requests", undefined, body("nounit", { businessUnitId: 9999 }));
  check("reunión: giro inexistente -> 422", noUnit.status === 422 && noUnit.json.error.code === "UNIT_NOT_FOUND", noUnit.json);
  const pastDay = await call("POST", "/public/meeting-requests", undefined, body("past", { preferredDate: "2020-01-01" }));
  check("reunión: fecha preferida pasada -> 422", pastDay.status === 422 && pastDay.json.error.code === "PREFERRED_DATE_INVALID", pastDay.json);
  const farDay = await call("POST", "/public/meeting-requests", undefined, body("far", { preferredDate: new Date(Date.now() + 400 * 864e5).toISOString().slice(0, 10) }));
  check("reunión: fecha preferida a más de 180 días -> 422", farDay.status === 422);

  const before = (await list(t.dueno)).total;
  const trap = await call("POST", "/public/meeting-requests", undefined, body("bot", { website: "http://spam.example" }));
  check("reunión: campo trampa -> responde igual pero no guarda nada", trap.status === 201 && (await list(t.dueno)).total === before, trap.json);

  // Reparto de vendedores: EXT solo tiene a "Vendedor Demo"; PRO tiene dos y se reparten.
  for (let i = 1; i <= 4; i++) await call("POST", "/public/meeting-requests", undefined, body(`pro${i}`, { businessUnitId: PRO, taxId: "", company: "" }));
  const maq = await call("POST", "/public/meeting-requests", undefined, body("maq", { businessUnitId: MAQ }));
  check("reunión: giro sin vendedores -> 201", maq.status === 201);

  const all = mine(await list(t.dueno));
  const bySeller = (unit: number) => all.filter((m: any) => m.businessUnitId === unit).reduce((acc: any, m: any) => ((acc[m.sellerName ?? "sin asignar"] = (acc[m.sellerName ?? "sin asignar"] ?? 0) + 1), acc), {});
  check("reunión: EXT se asigna al único vendedor del giro", JSON.stringify(bySeller(EXT)) === JSON.stringify({ "Vendedor Demo": 1 }), bySeller(EXT));
  const pro = bySeller(PRO);
  check("reunión: PRO se reparte entre sus dos vendedores (2 y 2)", pro["Vendedor Demo"] === 2 && pro["Vendedor Proceso Demo"] === 2, pro);
  check("reunión: MAQ queda sin vendedor asignado", JSON.stringify(bySeller(MAQ)) === JSON.stringify({ "sin asignar": 1 }), bySeller(MAQ));
  check("reunión: el NIT se normaliza y guarda", all.find((m: any) => m.contactEmail === mail("ext1")).taxId === "12345678");
  const sameNit = await call("POST", "/public/meeting-requests", undefined, body("ext2", { company: "Otro Nombre" }));
  const ext2 = mine(await list(t.dueno)).find((m: any) => m.contactEmail === mail("ext2"));
  check("reunión: mismo NIT reutiliza al cliente", sameNit.status === 201 && ext2.company === "Constructora Prueba", ext2);

  // Quién ve qué
  check("reuniones: sin token -> 401", (await call("GET", "/meetings")).status === 401);
  for (const [n, tok] of [["operativo", t.opPro], ["administrativo", t.admin], ["cliente", t.cliente]] as const) {
    check(`reuniones: ${n} -> 403`, (await call("GET", "/meetings", tok)).status === 403);
  }
  const vend = mine(await list(t.vendedor)), vp = mine(await list(t.vendProc)), gExt = mine(await list(t.gerExt)), gPro = mine(await list(t.gerPro));
  check("reuniones: el vendedor ve solo las asignadas a él", vend.length === 4 && vend.every((m: any) => m.sellerName === "Vendedor Demo"), vend.length);
  check("reuniones: el otro vendedor ve solo las suyas", vp.length === 2 && vp.every((m: any) => m.sellerName === "Vendedor Proceso Demo"), vp.length);
  check("reuniones: el gerente ve las de su giro, no las de otros", gExt.length === 2 && gExt.every((m: any) => m.businessUnitId === EXT) && gPro.length === 4 && gPro.every((m: any) => m.businessUnitId === PRO), [gExt.length, gPro.length]);
  check("reuniones: el dueño ve todas, incluida la sin vendedor", mine(await list(t.dueno)).length === 7);
  check("reuniones: el filtro por estado funciona", (await list(t.dueno, "status=cancelada&pageSize=100")).items.every((m: any) => m.status === "cancelada"));
  check("reuniones: estado inválido -> 400", (await call("GET", "/meetings?status=zzz", t.dueno)).status === 400);

  // Cambios de estado
  const target = ext2.id as number, other = all.find((m: any) => m.businessUnitId === EXT && m.contactEmail === mail("ext1")).id as number;
  const patch = (tok: string, id: number, b: any) => call("PATCH", `/meetings/${id}/status`, tok, b);
  const tomorrow = new Date(Date.now() + 864e5).toISOString();
  check("reunión: otro vendedor no la ve -> 404", (await patch(t.vendProc, target, { status: "cancelada" })).status === 404);
  check("reunión: un operativo no la ve -> 404", (await patch(t.opPro, target, { status: "cancelada" })).status === 404);
  check("reunión: el dueño la ve pero no la cambia -> 403", (await patch(t.dueno, target, { status: "cancelada" })).status === 403);
  check("reunión: gerente de otro giro -> 404", (await patch(t.gerPro, target, { status: "cancelada" })).status === 404);
  check("reunión: saltar a realizada -> 409", (await patch(t.vendedor, target, { status: "realizada" })).status === 409);
  const noDate = await patch(t.vendedor, target, { status: "confirmada" });
  check("reunión: confirmar sin fecha -> 422 SCHEDULE_REQUIRED", noDate.status === 422 && noDate.json.error.code === "SCHEDULE_REQUIRED", noDate.json);
  const pastDate = await patch(t.vendedor, target, { status: "confirmada", scheduledAt: "2020-01-01T10:00:00-06:00" });
  check("reunión: confirmar en el pasado -> 422", pastDate.status === 422 && pastDate.json.error.code === "SCHEDULE_IN_PAST", pastDate.json);
  check("reunión: fecha mal formada -> 400", (await patch(t.vendedor, target, { status: "confirmada", scheduledAt: "mañana" })).status === 400);
  const conf = await patch(t.vendedor, target, { status: "confirmada", scheduledAt: tomorrow });
  check("reunión: el vendedor asignado la confirma -> 200", conf.status === 200 && conf.json.status === "confirmada" && conf.json.scheduledAt, conf.json);
  check("reunión: confirmada -> realizada", (await patch(t.vendedor, target, { status: "realizada" })).json.status === "realizada");
  check("reunión: realizada es final -> 409", (await patch(t.vendedor, target, { status: "cancelada" })).status === 409);
  const byManager = await patch(t.gerExt, other, { status: "cancelada" });
  check("reunión: el gerente del giro puede cancelar -> 200", byManager.status === 200 && byManager.json.status === "cancelada", byManager.json);
  const orphan = all.find((m: any) => m.businessUnitId === MAQ).id as number;
  check("reunión sin vendedor: nadie del giro la gestiona -> 404", (await patch(t.gerExt, orphan, { status: "cancelada" })).status === 404);
  check("reunión inexistente -> 404", (await patch(t.vendedor, 999999, { status: "cancelada" })).status === 404);
}

console.log(`\n${pass} verificaciones correctas, ${failures.length} fallidas`);
if (failures.length) process.exit(1);
