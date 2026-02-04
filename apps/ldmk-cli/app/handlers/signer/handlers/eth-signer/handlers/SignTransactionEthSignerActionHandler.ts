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
} from "@ledgerhq/device-signer-kit-ethereum";
import { inject, injectable } from "inversify";

const DEFAULT_DERIVATION_PATH = "44'/60'/0'/0/0";

@injectable()
export class SignTransactionEthSignerActionHandler
  implements EthSignerActionHandler
{
  readonly type = EthSignerActionTypes.SIGN_TRANSACTION;
  readonly description = "Sign a transaction";
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
    const signTransactionInput = await this.getInput();

    return new Promise<boolean>((resolve) => {
      try {
        this.executeAndSubscribe(signTransactionInput, resolve);
      } catch (error) {
        this.displayError(error);
        resolve(true);
      }
    });
  }

  private async getInput(): Promise<{
    derivationPath: string;
    transactionHex: string;
    recipientDomain: string | undefined;
    skipOpenApp: boolean;
  }> {
    const derivationPath = await input({
      message: `Derivation path (default: ${DEFAULT_DERIVATION_PATH})`,
    });
    const transactionHex = await input({
      message: "Transaction (hex encoded, e.g., 0x...)",
    });
    const recipientDomain = await input({
      message: "Recipient domain (optional)",
    });
    const skipOpenApp = await this.promptYesNo("Skip open app", false);

    return {
      derivationPath: derivationPath.trim() || DEFAULT_DERIVATION_PATH,
      transactionHex,
      recipientDomain: recipientDomain.trim() || undefined,
      skipOpenApp,
    };
  }

  private executeAndSubscribe(
    params: {
      derivationPath: string;
      transactionHex: string;
      recipientDomain: string | undefined;
      skipOpenApp: boolean;
    },
    resolve: (value: boolean) => void,
  ): void {
    const transaction = this.hexStringToUint8Array(params.transactionHex);

    const signer = new SignerEthBuilder({
      dmk: this.dmkInstance,
      sessionId: this.appState.getDeviceSessionId()!,
    }).build();

    const { observable } = signer.signTransaction(
      params.derivationPath,
      transaction,
      {
        domain: params.recipientDomain,
        skipOpenApp: params.skipOpenApp,
      },
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

  private hexStringToUint8Array(hex: string): Uint8Array {
    const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (cleanHex.length === 0) {
      return new Uint8Array(0);
    }
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }
    return bytes;
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
    console.log(chalk.green("\nTransaction signed successfully!"));
    console.log(chalk.grey(`  r: ${output.r}`));
    console.log(chalk.grey(`  s: ${output.s}`));
    console.log(chalk.grey(`  v: ${output.v}`));
  }

  private displayError(error: unknown): void {
    console.log(chalk.red("\nFailed to sign transaction!"));
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
