import {
  type DeviceCommandType,
  type DeviceCommandTypes,
} from "@ldmk/app/handlers/device-command/handlers/DeviceCommandType";

export interface DeviceCommandHandler {
  type: DeviceCommandTypes;
  description: string;
  supports(type: DeviceCommandType): boolean;
  handle(): Promise<boolean>;
}
