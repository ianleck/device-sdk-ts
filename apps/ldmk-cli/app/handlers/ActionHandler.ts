import { type ActionTypes } from "@ldmk/app/handlers/ActionType";

export enum ConnectionMode {
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  BOTH = "both",
}

export interface ActionHandler {
  type: ActionTypes;
  description: string;
  connectionMode: ConnectionMode;
  supports(action: ActionTypes): boolean;
  handle(): Promise<boolean>; // returns true to exit current loop
}
