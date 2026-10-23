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
  gerTmp: await login("gerente.transporte@transport.gt"),
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
  check("relation=requester de EXT: solo pedidos que EXT solicita", req.items.every((o: any) => o.requestingUnitId === EXT));
  const mine = (await call("GET", "/orders?relation=requester", t.opPro)).json;
  check("sin giro: relation=requester usa mis giros", mine.total >= 1 && mine.items.every((o: any) => o.requestingUnitId === PRO));
  const st = (await call("GET", "/orders?status=entregado", t.dueno)).json;
  check("filtro por estado", st.items.length >= 1 && st.items.every((o: any) => o.status === "entregado"));
  const other = (await call("GET", `/orders?businessUnitId=${unitId("TPR")}`, t.opPro)).json;
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
  check("inventario: el dueño ve todo", dueno.status === 200 && new Set(dueno.json.items.map((i: any) => i.businessUnitId)).size === 6, dueno.json.items?.length);
  const pro = await call("GET", "/inventory", t.opPro);
  check("inventario: operativo PRO solo ve PRO", pro.status === 200 && pro.json.items.length >= 2 && pro.json.items.every((i: any) => i.businessUnitId === PRO));
  check("inventario: vendedor -> 403", (await call("GET", "/inventory", t.vendedor)).status === 403);
  check("inventario: cliente -> 403", (await call("GET", "/inventory", t.cliente)).status === 403);
  check("inventario: administrativo -> 403", (await call("GET", "/inventory", t.admin)).status === 403);
  check("inventario sin token -> 401", (await call("GET", "/inventory")).status === 401);

  const av = await call("GET", `/inventory/availability?businessUnitId=${EXT}`, t.opPro);
  check("disponibilidad: Proceso ve totales de Extracción sin detalle por sede", av.status === 200 && av.json.items.length === 2 && av.json.items.every((i: any) => typeof i.available === "number" && i.siteId === undefined), av.json);
  check("disponibilidad: suma las sedes del proveedor", Math.round(av.json.items.find((i: any) => i.productId === caliza).available) === Math.round(dueno.json.items.filter((i: any) => i.productId === caliza).reduce((s: number, i: any) => s + i.quantity, 0)));
  const avMaq = await call("GET", `/inventory/availability?businessUnitId=${MAQ}`, t.gerPro);
  check("disponibilidad: giro de servicios muestra su capacidad", avMaq.status === 200 && avMaq.json.items.length === 1 && avMaq.json.items[0].available > 0, avMaq.json);
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

// --- Alertas y GPS
{
  const GPS_TOKEN = process.env.GPS_SERVICE_TOKEN;
  if (!GPS_TOKEN) throw new Error("GPS_SERVICE_TOKEN no está definida");
  const ingest = async (events: any[], token: string | null = GPS_TOKEN) => {
    const res = await fetch(API + "/gps/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token !== null ? { "X-Service-Token": token } : {}) },
      body: JSON.stringify({ events }),
    });
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  };
  const reading = (deviceId: string, speedKmh: number, over: any = {}) => ({ deviceId, recordedAt: new Date().toISOString(), lat: 15.47, lng: -90.37, speedKmh, ...over });
  const evaluate = () => call("POST", "/alerts/evaluate", t.dueno);
  const list = async (tok: string, qs = "") => (await call("GET", `/alerts?pageSize=100${qs ? "&" + qs : ""}`, tok)).json;
  const find = (items: any[], type: string, pred: (p: any) => boolean) => items.find((a) => a.type === type && pred(a.payload));

  // Ingesta: autenticación y validación
  check("gps: sin token -> 401", (await ingest([reading("GPS-TMP-01", 50)], null)).status === 401);
  check("gps: token incorrecto -> 401", (await ingest([reading("GPS-TMP-01", 50)], "no-es-el-token")).status === 401);
  check("gps: un JWT de usuario no sirve como token de servicio -> 401", (await ingest([reading("GPS-TMP-01", 50)], t.dueno)).status === 401);
  check("gps: lista vacía -> 400", (await ingest([])).status === 400);
  check("gps: velocidad negativa -> 400", (await ingest([reading("GPS-TMP-01", -5)])).status === 400);
  check("gps: latitud fuera de rango -> 400", (await ingest([reading("GPS-TMP-01", 50, { lat: 123 })])).status === 400);
  check("gps: fecha sin zona horaria -> 400", (await ingest([reading("GPS-TMP-01", 50, { recordedAt: "2026-10-22T10:00:00" })])).status === 400);
  const unknown = await ingest([reading("GPS-NO-EXISTE", 50)]);
  check("gps: dispositivo desconocido -> 422 y se informa", unknown.status === 422 && unknown.json.accepted === 0 && unknown.json.rejected[0].deviceId === "GPS-NO-EXISTE", unknown.json);
  const future = await ingest([reading("GPS-TMP-01", 50, { recordedAt: new Date(Date.now() + 3600e3).toISOString() })]);
  check("gps: lectura en el futuro se rechaza", future.status === 422 && future.json.rejected[0].reason === "Fecha en el futuro", future.json);
  const mixed = await ingest([reading("GPS-TMP-01", 50), reading("GPS-NO-EXISTE", 50)]);
  check("gps: lote mixto acepta lo válido y rechaza el resto", mixed.status === 201 && mixed.json.accepted === 1 && mixed.json.rejected.length === 1, mixed.json);

  // Reglas y permisos de consulta
  check("alertas: sin token -> 401", (await call("GET", "/alerts")).status === 401);
  const rules = await call("GET", "/alert-rules", t.gerExt);
  check("reglas: el gerente las consulta (3 tipos)", rules.status === 200 && rules.json.items.length === 3 && rules.json.items.some((r: any) => r.type === "exceso_velocidad" && r.params.maxSpeedKmh === 80), rules.json);
  check("reglas: un operativo no -> 403", (await call("GET", "/alert-rules", t.opExt)).status === 403);
  check("evaluar: solo el dueño -> 403", (await call("POST", "/alerts/evaluate", t.gerExt)).status === 403);
  check("filtro inválido -> 400", (await call("GET", "/alerts?severity=zzz", t.dueno)).status === 400);

  // Exceso de velocidad: llega al gerente del giro y al dueño, a nadie más
  await ingest([reading("GPS-TMP-01", 40)]);
  await evaluate();
  const quiet = await list(t.gerTmp);
  check("exceso: a 40 km/h no hay alerta del camión", !find(quiet.items, "exceso_velocidad", (p) => p.assetName === "Camión TMP-01"));

  const hot = await ingest([reading("GPS-TMP-01", 112)]);
  check("exceso: la ingesta devuelve 201", hot.status === 201 && hot.json.accepted === 1, hot.json);
  const mine = await list(t.gerTmp);
  const alert = find(mine.items, "exceso_velocidad", (p) => p.assetName === "Camión TMP-01");
  check("exceso: el gerente del giro la recibe, crítica y con datos", alert && alert.severity === "critica" && alert.status === "abierta" && alert.payload.speedKmh === 112 && alert.payload.maxSpeedKmh === 80 && alert.businessUnitName === "Transporte de materia prima", alert);
  check("exceso: el dueño también la recibe", !!find((await list(t.dueno)).items, "exceso_velocidad", (p) => p.assetName === "Camión TMP-01"));
  for (const [name, tok] of [["gerente EXT", t.gerExt], ["operativo PRO", t.opPro], ["vendedor", t.vendedor], ["administrativo", t.admin], ["cliente", t.cliente]] as const) {
    check(`exceso: no la recibe ${name}`, !find((await list(tok)).items, "exceso_velocidad", (p) => p.assetName === "Camión TMP-01"));
  }
  check("alertas: el cliente sin membresías ve una lista vacía", (await list(t.cliente)).total === 0);
  check("alertas: el resumen cuenta críticas abiertas", mine.open.critica >= 1 && mine.open.total === mine.open.info + mine.open.aviso + mine.open.critica, mine.open);

  // Sin duplicados mientras siga la condición
  const countBefore = (await list(t.gerTmp)).items.filter((a: any) => a.payload.assetName === "Camión TMP-01").length;
  await ingest([reading("GPS-TMP-01", 125)]);
  await evaluate();
  const again = (await list(t.gerTmp)).items.filter((a: any) => a.payload.assetName === "Camión TMP-01");
  check("exceso: otra lectura alta no duplica la alerta, la actualiza", countBefore === 1 && again.length === 1 && again[0].id === alert.id && again[0].payload.speedKmh === 125, again);

  // Atender
  const other = await call("PATCH", `/alerts/${alert.id}`, t.gerExt, { status: "atendida" });
  check("atender: otro giro no la ve -> 404", other.status === 404 && other.json.error.code === "ALERT_NOT_FOUND", other.json);
  check("atender: el vendedor -> 404", (await call("PATCH", `/alerts/${alert.id}`, t.vendedor, { status: "atendida" })).status === 404);
  check("atender: estado inválido -> 400", (await call("PATCH", `/alerts/${alert.id}`, t.gerTmp, { status: "abierta" })).status === 400);
  check("atender: alerta inexistente -> 404", (await call("PATCH", "/alerts/999999", t.gerTmp, { status: "atendida" })).status === 404);
  const done = await call("PATCH", `/alerts/${alert.id}`, t.gerTmp, { status: "atendida" });
  check("atender: el gerente del giro la marca -> 200 con responsable", done.status === 200 && done.json.status === "atendida" && done.json.attendedByName === "Gerente Transporte Demo" && done.json.autoResolved === false, done.json);
  check("atender: es idempotente", (await call("PATCH", `/alerts/${alert.id}`, t.gerTmp, { status: "atendida" })).status === 200);
  check("atender: sale de las abiertas y aparece en las atendidas", !(await list(t.gerTmp)).items.some((a: any) => a.id === alert.id) && (await list(t.gerTmp, "status=atendida")).items.some((a: any) => a.id === alert.id));

  // Atendida pero con la condición vigente: no se vuelve a crear
  await ingest([reading("GPS-TMP-01", 130)]);
  await evaluate();
  check("atendida con exceso vigente: no se abre otra", !(await list(t.gerTmp)).items.some((a: any) => a.payload.assetName === "Camión TMP-01"));
  // Al normalizarse y volver a excederse sí es un evento nuevo
  await ingest([reading("GPS-TMP-01", 45)]);
  await ingest([reading("GPS-TMP-01", 99)]);
  const renewed = find((await list(t.gerTmp)).items, "exceso_velocidad", (p) => p.assetName === "Camión TMP-01");
  check("nuevo exceso tras normalizarse: alerta nueva", renewed && renewed.id !== alert.id, renewed);

  // Resolución automática
  await ingest([reading("GPS-TMP-01", 50)]);
  const auto = (await list(t.gerTmp, "status=atendida")).items.find((a: any) => a.id === renewed.id);
  check("al bajar la velocidad la alerta se resuelve sola", auto && auto.autoResolved === true && auto.attendedByName === null && auto.resolvedAt, auto);

  // Filtros
  const crit = await list(t.dueno, "severity=critica&type=exceso_velocidad&status=atendida");
  check("filtros: severidad y tipo", crit.items.length > 0 && crit.items.every((a: any) => a.severity === "critica" && a.type === "exceso_velocidad"));
  const byUnit = await list(t.dueno, `type=exceso_velocidad&businessUnitId=${EXT}`);
  check("filtro por giro", byUnit.items.every((a: any) => a.businessUnitId === EXT));
  const p1 = await call("GET", "/alerts?status=atendida&pageSize=1", t.dueno);
  check("paginación", p1.json.items.length === 1 && p1.json.pageSize === 1 && p1.json.total >= 2, p1.json);

  // Stock bajo: ajustar inventario por debajo del mínimo
  const inv = (await call("GET", `/inventory?businessUnitId=${EXT}`, t.gerExt)).json.items.find((i: any) => i.siteName === "Quetzaltenango" && i.productId === caliza);
  const invUrl = `/inventory/${inv.siteId}/${caliza}`;
  await call("PATCH", invUrl, t.opExt, { quantity: 60 });
  await evaluate();
  const stock = find((await list(t.opExt)).items, "stock_bajo", (p) => p.siteId === inv.siteId && p.productId === caliza);
  check("stock bajo: el operativo del giro la recibe, de aviso", stock && stock.severity === "aviso" && stock.payload.quantity === 60 && stock.payload.minThreshold === 100, stock);
  check("stock bajo: el gerente del giro y el dueño también", !!find((await list(t.gerExt)).items, "stock_bajo", (p) => p.siteId === inv.siteId) && !!find((await list(t.dueno)).items, "stock_bajo", (p) => p.siteId === inv.siteId));
  check("stock bajo: el otro giro no", !find((await list(t.gerPro)).items, "stock_bajo", (p) => p.siteId === inv.siteId));
  await call("PATCH", invUrl, t.opExt, { quantity: 0 });
  await evaluate();
  const empty = find((await list(t.opExt)).items, "stock_bajo", (p) => p.siteId === inv.siteId && p.productId === caliza);
  check("stock bajo: sin existencias sube a crítica (misma alerta)", empty && empty.severity === "critica" && empty.id === stock.id, empty);
  await call("PATCH", invUrl, t.gerExt, { quantity: 450 });
  await evaluate();
  const restored = (await list(t.opExt, "status=atendida")).items.find((a: any) => a.id === stock.id);
  check("stock bajo: al reponer se resuelve sola", restored && restored.autoResolved === true, restored);

  // Pedido retrasado: se crea un pedido y se vence su fecha directamente en la base (la API no admite fechas pasadas)
  const { default: postgres } = await import("postgres");
  const { databaseUrl } = await import("../src/db/url");
  const sql = postgres(databaseUrl());
  const gtDay = (ago: number) => new Date(Date.now() - 6 * 3600e3 - ago * 864e5).toISOString().slice(0, 10); // día en Guatemala (UTC-6)
  const mk = await call("POST", "/orders", t.opPro, createBody());
  const lateId = mk.json.id as number;
  await sql`update orders set due_date = ${gtDay(5)} where id = ${lateId}`;
  await evaluate();
  const late = find((await list(t.gerExt)).items, "pedido_retrasado", (p) => p.orderId === lateId);
  check("pedido retrasado: lo recibe el gerente del proveedor, con 5 días es crítica", late && late.severity === "critica" && late.payload.daysLate >= 4 && late.payload.requestingUnitName && late.payload.items.length === 1, late);
  check("pedido retrasado: también el operativo del proveedor y el dueño", !!find((await list(t.opExt)).items, "pedido_retrasado", (p) => p.orderId === lateId) && !!find((await list(t.dueno)).items, "pedido_retrasado", (p) => p.orderId === lateId));
  check("pedido retrasado: el solicitante no la recibe", !find((await list(t.gerPro)).items, "pedido_retrasado", (p) => p.orderId === lateId));
  await sql`update orders set due_date = ${gtDay(1)} where id = ${lateId}`;
  await evaluate();
  const soft = find((await list(t.gerExt)).items, "pedido_retrasado", (p) => p.orderId === lateId);
  check("pedido retrasado: con 1 día baja a aviso y conserva la alerta", soft && soft.severity === "aviso" && soft.id === late.id, soft);
  await call("PATCH", `/orders/${lateId}/status`, t.gerExt, { status: "cancelado" });
  await evaluate();
  const closed = (await list(t.gerExt, "status=atendida")).items.find((a: any) => a.id === late.id);
  check("pedido retrasado: al cancelar el pedido la alerta se resuelve sola", closed && closed.autoResolved === true, closed);
  await sql.end();

  // Dejar el entorno sin alertas de la prueba: la lectura final del camión queda normal
  await ingest([reading("GPS-TMP-01", 50)]);
}

// --- Panel consolidado del dueño
{
  const ov = await call("GET", "/reports/overview", t.dueno);
  check("overview: el dueño lo consulta", ov.status === 200 && ov.json.units.length === 6, ov.json);
  for (const [name, tok] of [["gerente", t.gerExt], ["operativo", t.opExt], ["vendedor", t.vendedor], ["administrativo", t.admin], ["cliente", t.cliente]] as const) {
    check(`overview: ${name} -> 403`, (await call("GET", "/reports/overview", tok)).status === 403);
  }
  check("overview: sin token -> 401", (await call("GET", "/reports/overview")).status === 401);
  const month = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 7);
  check("overview: por defecto el mes en curso", ov.json.period.from === `${month}-01` && ov.json.period.to.startsWith(month), ov.json.period);
  const sum = (k: string) => ov.json.units.reduce((n: number, u: any) => n + u[k], 0);
  check("overview: alertas y retrasos del total cuadran con los giros", ov.json.totals.openAlerts === sum("openAlerts") && ov.json.totals.criticalAlerts === sum("criticalAlerts") && ov.json.totals.overdueOrders === sum("overdue") && ov.json.totals.assets === sum("assets"), ov.json.totals);
  check("overview: las alertas abiertas coinciden con /alerts", ov.json.totals.openAlerts === (await call("GET", "/alerts?pageSize=1", t.dueno)).json.open.total);
  check("overview: cada giro trae una situación válida", ov.json.units.every((u: any) => ["normal", "vigilar", "atencion"].includes(u.situation)));
  check("overview: la extracción tiene pedidos entregados este mes", ov.json.units.find((u: any) => u.code === "EXT").deliveredInPeriod >= 1 && ov.json.totals.deliveredInPeriod === sum("deliveredInPeriod"));
  check("overview: lista de críticas ordenada y acotada", ov.json.criticalAlerts.length <= 5 && ov.json.criticalAlerts.length <= ov.json.totals.criticalAlerts);
  const past = await call("GET", "/reports/overview?from=2020-01-01&to=2020-01-31", t.dueno);
  check("overview: un período pasado no tiene entregas", past.status === 200 && past.json.totals.deliveredInPeriod === 0 && past.json.period.from === "2020-01-01", past.json);
  check("overview: solo from -> 400", (await call("GET", "/reports/overview?from=2026-01-01", t.dueno)).status === 400);
  check("overview: from posterior a to -> 400", (await call("GET", "/reports/overview?from=2026-02-01&to=2026-01-01", t.dueno)).status === 400);
  check("overview: período mayor a un año -> 400", (await call("GET", "/reports/overview?from=2024-01-01&to=2026-01-01", t.dueno)).status === 400);
  check("overview: fecha imposible -> 400", (await call("GET", "/reports/overview?from=2026-02-30&to=2026-03-01", t.dueno)).status === 400);
}

// --- Flota y GPS (P09)
{
  const post = async (events: any[]) => {
    const res = await fetch(API + "/gps/ingest", { method: "POST", headers: { "Content-Type": "application/json", "X-Service-Token": process.env.GPS_SERVICE_TOKEN! }, body: JSON.stringify({ events }) });
    return res.status;
  };
  const now = () => new Date().toISOString();
  const fleet = async (tok: string, qs = "") => call("GET", `/assets${qs}`, tok);
  const byName = (r: any, name: string) => r.json.items.find((a: any) => a.name === name);

  check("flota: sin token -> 401", (await call("GET", "/assets")).status === 401);
  for (const [name, tok] of [["vendedor", t.vendedor], ["administrativo", t.admin], ["cliente", t.cliente]] as const) {
    check(`flota: ${name} -> 403`, (await fleet(tok)).status === 403);
  }
  const all = await fleet(t.dueno);
  check("flota: el dueño ve los 5 activos con límite y antigüedad de la regla", all.status === 200 && all.json.items.length >= 5 && all.json.maxSpeedKmh === 80 && all.json.staleMinutes === 15, all.json);
  const mineTmp = await fleet(t.gerTmp);
  check("flota: el gerente de transporte solo ve su giro", mineTmp.json.items.length === 2 && mineTmp.json.items.every((a: any) => a.businessUnitName === "Transporte de materia prima"), mineTmp.json.items);
  check("flota: el gerente de Extracción solo ve el suyo", (await fleet(t.gerExt)).json.items.every((a: any) => a.businessUnitId === EXT));
  check("flota: un operativo de Proceso (sin activos) ve lista vacía", (await fleet(t.opPro)).json.items.length === 0);
  check("flota: filtro por tipo", (await fleet(t.dueno, "?kind=maquinaria")).json.items.every((a: any) => a.kind === "maquinaria"));
  check("flota: filtro por giro", (await fleet(t.dueno, `?businessUnitId=${EXT}`)).json.items.every((a: any) => a.businessUnitId === EXT));
  check("flota: tipo inválido -> 400", (await fleet(t.dueno, "?kind=barco")).status === 400);
  check("flota: estado inválido -> 400", (await fleet(t.dueno, "?status=volando")).status === 400);

  // Estados según la última lectura
  check("flota: ingesta de prueba", (await post([{ deviceId: "GPS-TMP-02", recordedAt: now(), lat: 14.97, lng: -89.53, speedKmh: 120 }])) === 201);
  let tmp2 = byName(await fleet(t.gerTmp), "Camión TMP-02");
  check("flota: sobre el límite -> exceso, con su última lectura", tmp2.status === "exceso" && tmp2.lastReading.speedKmh === 120 && tmp2.lastReading.lat === 14.97, tmp2);
  check("flota: el filtro por estado funciona", (await fleet(t.dueno, "?status=exceso")).json.items.some((a: any) => a.name === "Camión TMP-02"));
  await post([{ deviceId: "GPS-TMP-02", recordedAt: now(), lat: 14.97, lng: -89.53, speedKmh: 0 }]);
  check("flota: velocidad cero -> detenido", byName(await fleet(t.gerTmp), "Camión TMP-02").status === "detenido");
  await post([{ deviceId: "GPS-TMP-02", recordedAt: now(), lat: 14.97, lng: -89.53, speedKmh: 55 }]);
  check("flota: en movimiento -> en_ruta", byName(await fleet(t.gerTmp), "Camión TMP-02").status === "en_ruta");
  const exc = byName(await fleet(t.dueno, `?businessUnitId=${EXT}`), "Cargador EXT-01");
  check("flota: la maquinaria en movimiento está activa, no en ruta", ["activa", "detenido"].includes(exc.status), exc);

  // Historial
  const ev = await call("GET", `/assets/${tmp2.id}/events?limit=5`, t.gerTmp);
  check("eventos: más recientes primero y acotados", ev.status === 200 && ev.json.items.length === 5 && ev.json.items[0].speedKmh === 55 && ev.json.items[0].recordedAt >= ev.json.items[1].recordedAt && ev.json.maxSpeedKmh === 80, ev.json);
  check("eventos: el dueño también", (await call("GET", `/assets/${tmp2.id}/events`, t.dueno)).status === 200);
  check("eventos: otro giro -> 404", (await call("GET", `/assets/${tmp2.id}/events`, t.gerExt)).status === 404);
  check("eventos: vendedor -> 404", (await call("GET", `/assets/${tmp2.id}/events`, t.vendedor)).status === 404);
  check("eventos: activo inexistente -> 404", (await call("GET", "/assets/999999/events", t.dueno)).status === 404);
  check("eventos: límite 0 -> 400", (await call("GET", `/assets/${tmp2.id}/events?limit=0`, t.dueno)).status === 400);
  check("eventos: límite excesivo -> 400", (await call("GET", `/assets/${tmp2.id}/events?limit=500`, t.dueno)).status === 400);
  check("eventos: id no numérico -> 400", (await call("GET", "/assets/abc/events", t.dueno)).status === 400);
}

// --- API B2B (terceros)
{
  const DEMO_KEY = process.env.B2B_DEMO_API_KEY;
  if (!DEMO_KEY) throw new Error("B2B_DEMO_API_KEY no está definida");
  const { default: postgres } = await import("postgres");
  const { databaseUrl } = await import("../src/db/url");
  const { generateApiKey } = await import("../src/b2b/keys");
  const sql = postgres(databaseUrl());

  // Clientes de prueba: solo lectura, restringido a Extracción e inactivo.
  const mkClient = async (name: string, scopes: string[], unitIds: number[], active = true) => {
    const k = generateApiKey();
    const [row] = await sql`insert into api_clients (name, key_prefix, key_hash, scopes, unit_ids, active) values (${name}, ${k.keyPrefix}, ${k.keyHash}, ${scopes}, ${unitIds}, ${active}) returning id`;
    return { key: k.key, id: row.id as number };
  };
  const readOnly = await mkClient("e2e solo lectura", ["orders:read", "catalog:read"], [EXT]);
  const extOnly = await mkClient("e2e solo Extracción", ["orders:read", "orders:write", "catalog:read"], [EXT]);
  const inactive = await mkClient("e2e inactivo", ["orders:read", "orders:write"], [EXT], false);

  const b2b = async (method: string, path: string, key?: string, body?: unknown) => {
    const res = await fetch(`${API}/b2b${path}`, {
      method,
      headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  };
  const ref = () => `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const due = new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10);
  const body = (over: any = {}) => ({ externalRef: ref(), dueDate: due, items: [{ productId: caliza, quantity: 25 }], ...over });

  // Autenticación
  check("b2b: sin clave -> 401", (await b2b("GET", "/orders")).status === 401);
  check("b2b: clave basura -> 401", (await b2b("GET", "/orders", "no-es-una-clave")).status === 401);
  check("b2b: clave con forma válida pero desconocida -> 401", (await b2b("GET", "/orders", `tp_live_${"A".repeat(43)}`)).status === 401);
  check("b2b: un JWT de usuario no sirve como clave -> 401", (await b2b("GET", "/orders", t.dueno)).status === 401);
  const inact = await b2b("GET", "/orders", inactive.key);
  check("b2b: clave de un cliente inactivo -> 401 (igual que una desconocida)", inact.status === 401 && inact.json.error.code === "UNAUTHORIZED", inact.json);
  check("b2b: la clave de API no sirve en las rutas de usuarios -> 401", (await call("GET", "/orders", DEMO_KEY)).status === 401);

  // Alcances
  const ro = await b2b("POST", "/orders", readOnly.key, body());
  check("b2b: sin orders:write -> 403 INSUFFICIENT_SCOPE", ro.status === 403 && ro.json.error.code === "INSUFFICIENT_SCOPE", ro.json);

  // Catálogo
  const cat = await b2b("GET", "/products", DEMO_KEY);
  check("b2b: catálogo solo de los giros del cliente (Extracción y Proceso)", cat.status === 200 && cat.json.items.length >= 4 && cat.json.items.every((p: any) => [EXT, PRO].includes(p.supplier.id)), cat.json);
  check("b2b: catálogo acotado a Extracción para el otro cliente", (await b2b("GET", "/products", extOnly.key)).json.items.every((p: any) => p.supplier.id === EXT));

  // Crear
  const first = body();
  const created = await b2b("POST", "/orders", DEMO_KEY, first);
  check("b2b: crear pedido -> 201 solicitado", created.status === 201 && created.json.status === "solicitado" && created.json.externalRef === first.externalRef && created.json.supplier.id === EXT && created.json.items[0].quantity === 25, created.json);
  check("b2b: la respuesta no expone datos internos", !("createdByUserId" in created.json) && !("apiClientId" in created.json) && created.json.history.length === 1 && !("actorName" in created.json.history[0]), created.json);
  const orderId = created.json.id as number;

  const again = await b2b("POST", "/orders", DEMO_KEY, first);
  check("b2b: reenviar lo mismo -> 200 con el mismo pedido", again.status === 200 && again.json.id === orderId, again.json);
  const changed = await b2b("POST", "/orders", DEMO_KEY, { ...first, items: [{ productId: caliza, quantity: 26 }] });
  check("b2b: misma referencia con otro contenido -> 409 IDEMPOTENCY_CONFLICT", changed.status === 409 && changed.json.error.code === "IDEMPOTENCY_CONFLICT", changed.json);
  const sameRefOtherClient = await b2b("POST", "/orders", extOnly.key, first);
  check("b2b: la misma referencia en otro cliente es otro pedido", sameRefOtherClient.status === 201 && sameRefOtherClient.json.id !== orderId, sameRefOtherClient.json);

  const racy = body();
  const [r1, r2, r3] = await Promise.all([b2b("POST", "/orders", DEMO_KEY, racy), b2b("POST", "/orders", DEMO_KEY, racy), b2b("POST", "/orders", DEMO_KEY, racy)]);
  const ids = new Set([r1, r2, r3].map((r) => r.json?.id));
  check("b2b: tres solicitudes simultáneas con la misma referencia crean un solo pedido", ids.size === 1 && [r1, r2, r3].filter((r) => r.status === 201).length === 1 && [r1, r2, r3].every((r) => r.status === 200 || r.status === 201), [r1.status, r2.status, r3.status]);

  // Validaciones
  const bad = async (name: string, over: any, status: number, code?: string) => {
    const r = await b2b("POST", "/orders", DEMO_KEY, body(over));
    check(`b2b: ${name} -> ${status}`, r.status === status && (!code || r.json.error.code === code), r.json);
  };
  await bad("sin productos", { items: [] }, 400);
  await bad("producto repetido", { items: [{ productId: caliza, quantity: 1 }, { productId: caliza, quantity: 2 }] }, 400);
  await bad("cantidad cero", { items: [{ productId: caliza, quantity: 0 }] }, 400);
  await bad("cantidad no numérica", { items: [{ productId: caliza, quantity: "mucho" }] }, 400);
  await bad("referencia con espacios", { externalRef: "con espacios" }, 400);
  await bad("referencia vacía", { externalRef: "" }, 400);
  await bad("fecha mal formada", { dueDate: "mañana" }, 400);
  await bad("fecha pasada", { dueDate: "2020-01-01" }, 422, "DUE_DATE_IN_PAST");
  await bad("producto inexistente", { items: [{ productId: 999999, quantity: 1 }] }, 422, "PRODUCT_NOT_FOUND");
  await bad("giro no permitido al cliente (Maquinaria)", { items: [{ productId: (await sql`select id from products where business_unit_id = ${MAQ} limit 1`)[0].id, quantity: 1 }] }, 422, "PRODUCT_NOT_ALLOWED");
  await bad("productos de dos giros", { items: [{ productId: caliza, quantity: 1 }, { productId: agregado, quantity: 1 }] }, 422, "MIXED_SUPPLIERS");
  check("b2b: cliente restringido a Extracción no puede pedir de Proceso -> 422", (await b2b("POST", "/orders", extOnly.key, body({ items: [{ productId: agregado, quantity: 1 }] }))).json.error.code === "PRODUCT_NOT_ALLOWED");

  // Consulta
  const got = await b2b("GET", `/orders/${orderId}`, DEMO_KEY);
  check("b2b: consultar un pedido propio", got.status === 200 && got.json.id === orderId, got.json);
  check("b2b: el pedido de otro cliente no existe -> 404", (await b2b("GET", `/orders/${orderId}`, extOnly.key)).status === 404);
  check("b2b: id inexistente -> 404", (await b2b("GET", "/orders/999999", DEMO_KEY)).status === 404);
  check("b2b: id no numérico -> 400", (await b2b("GET", "/orders/abc", DEMO_KEY)).status === 400);
  const list = await b2b("GET", "/orders?pageSize=2", DEMO_KEY);
  check("b2b: lista paginada solo con pedidos propios", list.status === 200 && list.json.items.length === 2 && list.json.total >= 3 && list.json.items.every((o: any) => o.externalRef), list.json.total);
  const others = await b2b("GET", "/orders?pageSize=100", extOnly.key);
  check("b2b: la lista de otro cliente no incluye los pedidos ajenos", others.json.items.every((o: any) => o.id !== orderId) && others.json.total === 1, others.json.total);
  check("b2b: filtro por estado", (await b2b("GET", "/orders?status=entregado", DEMO_KEY)).json.items.every((o: any) => o.status === "entregado"));
  check("b2b: estado inválido -> 400", (await b2b("GET", "/orders?status=zzz", DEMO_KEY)).status === 400);
  check("b2b: updatedSince en el futuro -> vacío", (await b2b("GET", `/orders?updatedSince=${encodeURIComponent(new Date(Date.now() + 864e5).toISOString())}`, DEMO_KEY)).json.total === 0);
  check("b2b: updatedSince en el pasado incluye el pedido", (await b2b("GET", `/orders?updatedSince=${encodeURIComponent(new Date(Date.now() - 60e3).toISOString())}`, DEMO_KEY)).json.items.some((o: any) => o.id === orderId));
  check("b2b: updatedSince sin zona horaria -> 400", (await b2b("GET", "/orders?updatedSince=2026-01-01T00:00:00", DEMO_KEY)).status === 400);

  // El personal ve y gestiona el pedido del tercero
  const staff = await call("GET", `/orders/${orderId}`, t.gerExt);
  check("tercero: el gerente del proveedor lo ve con el cliente como solicitante", staff.status === 200 && staff.json.kind === "tercero" && staff.json.requestingUnitName === "Cementos Ejemplo, S. A." && staff.json.history[0].actorName === "Cementos Ejemplo, S. A.", staff.json);
  check("tercero: el dueño también", (await call("GET", `/orders/${orderId}`, t.dueno)).status === 200);
  check("tercero: otro giro no lo ve -> 404", (await call("GET", `/orders/${orderId}`, t.gerPro)).status === 404);
  check("tercero: el gerente puede aprobarlo (allowedTransitions)", staff.json.allowedTransitions.includes("aprobado"));
  const approve = await call("PATCH", `/orders/${orderId}/status`, t.gerExt, { status: "aprobado" });
  check("tercero: aprobar -> 200", approve.status === 200 && approve.json.status === "aprobado", approve.json);
  check("tercero: el cliente ve el nuevo estado y el historial", (await b2b("GET", `/orders/${orderId}`, DEMO_KEY)).json.history.map((h: any) => h.toStatus).join() === "solicitado,aprobado");
  check("tercero: el operativo no puede aprobar (ya aprobado) pero sí avanzar", (await call("PATCH", `/orders/${orderId}/status`, t.opExt, { status: "en_proceso" })).status === 200);
  check("tercero: despachar descuenta existencias del proveedor", (await call("PATCH", `/orders/${orderId}/status`, t.opExt, { status: "despachado" })).status === 200);
  const delivered = await call("PATCH", `/orders/${orderId}/status`, t.opExt, { status: "entregado" });
  check("tercero: el personal del proveedor confirma la entrega (no hay giro solicitante)", delivered.status === 200 && delivered.json.status === "entregado", delivered.json);
  check("tercero: el cliente ve el pedido entregado", (await b2b("GET", `/orders/${orderId}`, DEMO_KEY)).json.status === "entregado");
  check("tercero: un operativo de otro giro no lo gestiona -> 404", (await call("PATCH", `/orders/${orderId}/status`, t.opPro, { status: "cancelado" })).status === 404);

  // Limpieza de lo creado por esta prueba (los pedidos de la demo no se tocan)
  const ids2 = [readOnly.id, extOnly.id, inactive.id];
  const mine = sql`select id from orders where api_client_id = any(${ids2}) or external_ref like 'E2E-%'`;
  await sql`delete from order_status_events where order_id in (${mine})`;
  await sql`delete from order_items where order_id in (${mine})`;
  await sql`delete from orders where id in (${mine})`;
  await sql`delete from api_clients where id = any(${ids2})`;
  await sql.end();
}

console.log(`\n${pass} verificaciones correctas, ${failures.length} fallidas`);
if (failures.length) process.exit(1);
