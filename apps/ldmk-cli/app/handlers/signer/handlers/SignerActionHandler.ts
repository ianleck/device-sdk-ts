import {
  type SignerType,
  type SignerTypes,
} from "@ldmk/app/handlers/signer/handlers/SignerType";

export interface SignerActionHandler {
  type: SignerTypes;
  description: string;
  supports(type: SignerType): boolean;
  handle(): Promise<boolean>;
}
