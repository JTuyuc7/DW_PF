export type Role = "dueno" | "gerente" | "vendedor" | "operativo" | "administrativo";

export type Membership = { businessUnitId: number | null; role: Role };

// Permisos del usuario autenticado, cargados desde la base en cada solicitud.
export type Access = { userId: number; memberships: Membership[] };

export type AppEnv = {
  Variables: {
    requestId: string;
    jwtPayload: { sub: string; exp: number };
    access: Access;
  };
};
