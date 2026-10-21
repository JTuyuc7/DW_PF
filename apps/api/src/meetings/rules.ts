export const MEETING_STATUSES = ["solicitada", "confirmada", "realizada", "cancelada"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

// Transiciones permitidas. Las reuniones realizadas o canceladas no cambian.
export const MEETING_TRANSITIONS: Record<MeetingStatus, readonly MeetingStatus[]> = {
  solicitada: ["confirmada", "cancelada"],
  confirmada: ["realizada", "cancelada"],
  realizada: [],
  cancelada: [],
};

export const canMoveMeeting = (from: MeetingStatus, to: MeetingStatus) => MEETING_TRANSITIONS[from].includes(to);

/** Estados que cuentan como carga de trabajo de un vendedor al repartir nuevas solicitudes. */
export const OPEN_MEETING_STATUSES = ["solicitada", "confirmada"] as const satisfies readonly MeetingStatus[];
