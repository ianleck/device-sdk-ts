import "zx/globals";

import { input } from "@inquirer/prompts";
import { appTypes } from "@ldmk/app/di/app.types";
import { EthSignerActionHandler } from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/EthSignerActionHandler";
import {
  EthSignerActionType,
  EthSignerActionTypes,
} from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/EthSignerActionType";
import { type AppState } from "@ldmk/app/state/AppState";
import { UserInteractionFormatter } from "@ldmk/app/utils/UserInteractionFormatter";
import {
  type DeviceActionIntermediateValue,
  type DeviceActionState,
  DeviceActionStatus,
  DeviceManagementKit,
} from "@ledgerhq/device-management-kit";
import { SignerEthBuilder } from "@ledgerhq/device-signer-kit-ethereum";
import { inject, injectable } from "inversify";

const DEFAULT_CHAIN_ID = 1;

@injectable()
export class VerifySafeAddressEthSignerActionHandler
  implements EthSignerActionHandler
{
  readonly type = EthSignerActionTypes.VERIFY_SAFE_ADDRESS;
  readonly description = "Verify Safe address";
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
    const verifySafeAddressInput = await this.getInput();

    return new Promise<boolean>((resolve) => {
      try {
        this.executeAndSubscribe(verifySafeAddressInput, resolve);
      } catch (error) {
        this.displayError(error);
        resolve(true);
      }
    });
  }

  private async getInput(): Promise<{
    safeContractAddress: string;
    chainId: number;
    skipOpenApp: boolean;
  }> {
    const safeContractAddress = await input({
      message: "Safe contract address",
    });
    const chainIdStr = await input({
      message: `Chain ID (default: ${DEFAULT_CHAIN_ID})`,
    });
    const skipOpenApp = await this.promptYesNo("Skip open app", false);

    const chainId = chainIdStr.trim()
      ? parseInt(chainIdStr, 10)
      : DEFAULT_CHAIN_ID;

    return {
      safeContractAddress: safeContractAddress.trim(),
      chainId,
      skipOpenApp,
    };
  }

  private executeAndSubscribe(
    params: {
      safeContractAddress: string;
      chainId: number;
      skipOpenApp: boolean;
    },
    resolve: (value: boolean) => void,
  ): void {
    const signer = new SignerEthBuilder({
      dmk: this.dmkInstance,
      sessionId: this.appState.getDeviceSessionId()!,
    }).build();

    const { observable } = signer.verifySafeAddress(
      params.safeContractAddress,
      {
        chainId: params.chainId,
        skipOpenApp: params.skipOpenApp,
      },
    );

    observable.subscribe({
      next: (
        state: DeviceActionState<void, unknown, DeviceActionIntermediateValue>,
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
    state: DeviceActionState<void, unknown, DeviceActionIntermediateValue>,
  ): void {
    switch (state.status) {
      case DeviceActionStatus.Pending:
        this.displayPendingInteraction(
          state.intermediateValue.requiredUserInteraction,
        );
        break;
      case DeviceActionStatus.Completed:
        console.log(
          chalk.green("\nSafe address verification completed successfully!"),
        );
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

  private displayError(error: unknown): void {
    console.log(chalk.red("\nFailed to verify Safe address!"));
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
