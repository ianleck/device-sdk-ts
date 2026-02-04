import "zx/globals";

import { input } from "@inquirer/prompts";
import { appTypes } from "@ldmk/app/di/app.types";
import { EthSignerActionHandler } from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/EthSignerActionHandler";
import {
  EthSignerActionType,
  EthSignerActionTypes,
} from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/EthSignerActionType";
import { AppState } from "@ldmk/app/state/AppState";
import { UserInteractionFormatter } from "@ldmk/app/utils/UserInteractionFormatter";
import {
  type DeviceActionIntermediateValue,
  type DeviceActionState,
  DeviceActionStatus,
  DeviceManagementKit,
} from "@ledgerhq/device-management-kit";
import {
  type Signature,
  SignerEthBuilder,
  type TypedData,
} from "@ledgerhq/device-signer-kit-ethereum";
import { inject, injectable } from "inversify";

const DEFAULT_DERIVATION_PATH = "44'/60'/0'/0/0";
const DEFAULT_TYPED_MESSAGE = `{"domain":{"name":"USD Coin","verifyingContract":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"version":"2"},"primaryType":"Permit","message":{"deadline":1718992051,"nonce":0,"spender":"0x111111125421ca6dc452d289314280a0f8842a65","owner":"0x6cbcd73cd8e8a42844662f0a0e76d7f79afd933d","value":"115792089237316195423570985008687907853269984665640564039457584007913129639935"},"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Permit":[{"name":"owner","type":"address"},{"name":"spender","type":"address"},{"name":"value","type":"uint256"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]}}`;

@injectable()
export class SignTypedDataEthSignerActionHandler
  implements EthSignerActionHandler
{
  readonly type = EthSignerActionTypes.SIGN_TYPED_DATA;
  readonly description = "Sign typed data (EIP-712)";
  private lastInteraction = "";

  constructor(
    @inject(appTypes.DMKInstance)
    private readonly dmkInstance: DeviceManagementKit,
    @inject(appTypes.AppState)
    private readonly appState: AppState,
  ) {}

  public supports(type: EthSignerActionType): boolean {
    return type === this.type;
  }

  public async handle(): Promise<boolean> {
    const signTypedDataInput = await this.getInput();

    return new Promise<boolean>((resolve) => {
      try {
        this.executeAndSubscribe(signTypedDataInput, resolve);
      } catch (error) {
        this.displayError(error);
        resolve(true);
      }
    });
  }

  private async getInput(): Promise<{
    derivationPath: string;
    typedDataJson: string;
    skipOpenApp: boolean;
  }> {
    const derivationPath = await input({
      message: `Derivation path (default: ${DEFAULT_DERIVATION_PATH})`,
    });
    const messageInput = await input({
      message: "Typed data JSON (default: sample EIP-712 Permit message)",
    });
    const skipOpenApp = await this.promptYesNo("Skip open app", false);

    const typedDataJson = messageInput.trim() || DEFAULT_TYPED_MESSAGE;

    try {
      JSON.parse(typedDataJson);
    } catch (e) {
      throw new Error(
        `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    return {
      derivationPath: derivationPath.trim() || DEFAULT_DERIVATION_PATH,
      typedDataJson,
      skipOpenApp,
    };
  }

  private executeAndSubscribe(
    params: {
      derivationPath: string;
      typedDataJson: string;
      skipOpenApp: boolean;
    },
    resolve: (value: boolean) => void,
  ): void {
    const typedData: TypedData = JSON.parse(params.typedDataJson) as TypedData;

    const signer = new SignerEthBuilder({
      dmk: this.dmkInstance,
      sessionId: this.appState.getDeviceSessionId()!,
    }).build();

    const { observable } = signer.signTypedData(
      params.derivationPath,
      typedData,
      { skipOpenApp: params.skipOpenApp },
    );

    observable.subscribe({
      next: (
        state: DeviceActionState<
          Signature,
          unknown,
          DeviceActionIntermediateValue
        >,
      ) => {
        this.handleState(state);
      },
      complete: () => resolve(false),
      error: (err: unknown) => {
        this.displayError(err);
        resolve(true);
      },
    });
  }

  private handleState(
    state: DeviceActionState<Signature, unknown, DeviceActionIntermediateValue>,
  ): void {
    switch (state.status) {
      case DeviceActionStatus.Pending:
        this.displayPendingInteraction(
          state.intermediateValue.requiredUserInteraction,
        );
        break;
      case DeviceActionStatus.Completed:
        this.displayOutput(state.output);
        break;
      case DeviceActionStatus.Error:
        this.displayError(state.error);
        break;
    }
  }

  private displayPendingInteraction(interaction: string | undefined): void {
    if (!interaction) return;
    const message = UserInteractionFormatter.format(interaction);
    if (message && message !== this.lastInteraction) {
      this.lastInteraction = message;
      console.log(chalk.yellow(message));
    }
  }

  private displayOutput(output: Signature): void {
    console.log(chalk.green("\nTyped data signed successfully!"));
    console.log(chalk.grey(`  r: ${output.r}`));
    console.log(chalk.grey(`  s: ${output.s}`));
    console.log(chalk.grey(`  v: ${output.v}`));
  }

  private displayError(error: unknown): void {
    console.log(chalk.red("\nFailed to sign typed data!"));
    console.log(
      chalk.red(
        error instanceof Error ? error.message : "Is your device connected?",
      ),
    );
  }

  private async promptYesNo(
    message: string,
    defaultValue: boolean,
  ): Promise<boolean> {
    const defaultText = defaultValue ? "yes" : "no";
    const response = await input({
      message: `${message} (yes/no, default: ${defaultText})`,
    });
    if (response.trim() === "") {
      return defaultValue;
    }
    return response.toLowerCase() === "yes" || response.toLowerCase() === "y";
  }
}
