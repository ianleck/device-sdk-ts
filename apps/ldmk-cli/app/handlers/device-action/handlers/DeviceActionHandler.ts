import {
  type DeviceActionType,
  type DeviceActionTypes,
} from "@ldmk/app/handlers/device-action/handlers/DeviceActionType";

export interface DeviceActionHandler {
  type: DeviceActionTypes;
  description: string;
  supports(type: DeviceActionType): boolean;
  handle(): Promise<boolean>;
}
