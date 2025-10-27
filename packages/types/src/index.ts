export type PlayerId = string;

export interface RoomMessage<TPayload = unknown> {
  type: string;
  payload: TPayload;
}
