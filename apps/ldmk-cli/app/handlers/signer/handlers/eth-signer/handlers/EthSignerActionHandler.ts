import {
  type EthSignerActionType,
  type EthSignerActionTypes,
} from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/EthSignerActionType";

export interface EthSignerActionHandler {
  type: EthSignerActionTypes;
  description: string;
  supports(type: EthSignerActionType): boolean;
  handle(): Promise<boolean>;
}
