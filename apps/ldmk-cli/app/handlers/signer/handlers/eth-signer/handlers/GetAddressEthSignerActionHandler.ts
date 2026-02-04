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
  type GetAddressDAOutput,
  SignerEthBuilder,
} from "@ledgerhq/device-signer-kit-ethereum";
import { inject, injectable } from "inversify";

const DEFAULT_DERIVATION_PATH = "44'/60'/0'/0/0";

@injectable()
export class GetAddressEthSignerActionHandler
  implements EthSignerActionHandler
{
  readonly type = EthSignerActionTypes.GET_ADDRESS;
  readonly description = "Get Ethereum address";
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
    const getAddressInput = await this.getInput();
    return new Promise<boolean>((resolve) => {
      try {
        this.executeAndSubscribe(getAddressInput, resolve);
      } catch (error) {
        this.displayError(error);
        resolve(true);
      }
    });
  }

  private async getInput(): Promise<{
    derivationPath: string;
    checkOnDevice: boolean;
    returnChainCode: boolean;
    skipOpenApp: boolean;
  }> {
    const derivationPath = await input({
      message: `Derivation path (default: ${DEFAULT_DERIVATION_PATH})`,
    });
    const checkOnDevice = await this.promptYesNo("Check on device", false);
    const returnChainCode = await this.promptYesNo("Return chain code", false);
    const skipOpenApp = await this.promptYesNo("Skip open app", false);

    return {
      derivationPath: derivationPath.trim() || DEFAULT_DERIVATION_PATH,
      checkOnDevice,
      returnChainCode,
      skipOpenApp,
    };
  }

  private executeAndSubscribe(
    params: {
      derivationPath: string;
      checkOnDevice: boolean;
      returnChainCode: boolean;
      skipOpenApp: boolean;
    },
    resolve: (value: boolean) => void,
  ): void {
    const signer = new SignerEthBuilder({
      dmk: this.dmkInstance,
      sessionId: this.appState.getDeviceSessionId()!,
    }).build();

    const { observable } = signer.getAddress(params.derivationPath, {
      checkOnDevice: params.checkOnDevice,
      returnChainCode: params.returnChainCode,
      skipOpenApp: params.skipOpenApp,
    });

    observable.subscribe({
      next: (
        state: DeviceActionState<
          GetAddressDAOutput,
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
    state: DeviceActionState<
      GetAddressDAOutput,
      unknown,
      DeviceActionIntermediateValue
    >,
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

  private displayOutput(output: GetAddressDAOutput): void {
    console.log(chalk.green("\nAddress retrieved successfully!"));
    console.log(chalk.grey(`  Address: ${output.address}`));
    console.log(chalk.grey(`  Public Key: ${output.publicKey}`));
    if (output.chainCode) {
      console.log(chalk.grey(`  Chain Code: ${output.chainCode}`));
    }
  }

  private displayError(error: unknown): void {
    console.log(chalk.red("\nFailed to get address!"));
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
